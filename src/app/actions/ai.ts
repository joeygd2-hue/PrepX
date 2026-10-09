"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { userOrThrow } from "@/server/auth/session";
import { LimitReachedError } from "@/server/entitlements";
import { AiFailedError, AiNotConfiguredError, type ImageInput } from "@/server/ai/provider";
import { checkExplanation, coachReply, evaluatePerformance, generateScenario, likelyQuestions, rateAnswer, type RubricItem, type Scenario } from "@/server/ai/tasks";
import { withUsage } from "@/server/ai/run";
import { activeSelection, awardXp, recordActivity, syncAchievements } from "@/server/progress";
import { autoCompleteTask } from "@/server/dashboard";
import { rateLimit } from "@/server/ratelimit";
import { XP } from "@/lib/levels";

export type AiResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string; limit?: boolean };

function fail(e: unknown): { ok: false; error: string; limit?: boolean } {
  if (e instanceof LimitReachedError) return { ok: false, error: `You've reached today's limit for this feature on your plan. ${e.resetsLabel}.`, limit: true };
  if (e instanceof AiNotConfiguredError || e instanceof AiFailedError) return { ok: false, error: e.message };
  console.error("ai action failed", (e as Error)?.message);
  return { ok: false, error: "Something went wrong. You weren't charged. Please try again." };
}

async function guardBurst(userId: string) {
  if (!(await rateLimit(`ai:${userId}`, 30, 300))) throw new AiFailedError("You're sending requests very quickly. Wait a minute and try again.");
}

async function ownedSession(userId: string, id: string) {
  const [s] = await db.select().from(schema.aiSessions).where(and(eq(schema.aiSessions.id, id), eq(schema.aiSessions.userId, userId)));
  if (!s) throw new Error("Session not found");
  return s;
}

/* ───────── Coach ───────── */

export async function sendCoachMessage(sessionId: string | null, text: string): Promise<AiResult<{ sessionId: string; reply: string }>> {
  const user = await userOrThrow();
  const msg = z.string().trim().min(1).max(4000).safeParse(text);
  if (!msg.success) return { ok: false, error: "Type a message (up to 4,000 characters)." };
  try {
    await guardBurst(user.id);
    const tz = user.profile!.timezone;
    const sel = await activeSelection(user.id);
    let session = sessionId ? await ownedSession(user.id, sessionId) : null;
    if (!session) {
      [session] = await db
        .insert(schema.aiSessions)
        .values({ userId: user.id, kind: "coach", eventId: sel?.event.id ?? null, title: msg.data.slice(0, 80) })
        .returning();
    }
    const history = await db.select().from(schema.aiMessages).where(eq(schema.aiMessages.sessionId, session.id)).orderBy(asc(schema.aiMessages.createdAt));
    const [event] = session.eventId ? await db.select().from(schema.events).where(eq(schema.events.id, session.eventId)) : [null];
    const turns = [...history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })), { role: "user" as const, content: msg.data }];
    const reply = await withUsage(user.id, "coach_message", tz, () => coachReply(event, turns));
    await db.insert(schema.aiMessages).values([
      { sessionId: session.id, role: "user", content: msg.data },
      { sessionId: session.id, role: "assistant", content: reply },
    ]);
    await db.update(schema.aiSessions).set({ updatedAt: new Date() }).where(eq(schema.aiSessions.id, session.id));
    if (!history.length) {
      await awardXp(user.id, XP.coachSession, "coach", session.id);
      await recordActivity(user.id, tz);
      await autoCompleteTask(user.id, tz, ["coach"]);
    }
    return { ok: true, data: { sessionId: session.id, reply } };
  } catch (e) {
    return fail(e);
  }
}

/** Builds a debrief prompt from the student's latest judge feedback (their own data only). */
export async function debriefContext() {
  const user = await userOrThrow();
  const [fb] = await db
    .select()
    .from(schema.aiFeedback)
    .where(eq(schema.aiFeedback.userId, user.id))
    .orderBy(desc(schema.aiFeedback.createdAt))
    .limit(1);
  if (!fb) return "I haven't done a judge run yet. What should I focus on first for my event?";
  const weakest = [...fb.criteria].sort((a, b) => a.rating - b.rating).slice(0, 2);
  return `Debrief my last practice judge run (practice score ${fb.score}/100). My weakest areas were: ${weakest.map((w) => `${w.label} (${w.rating}/5: ${w.comment})`).join("; ")}. What's my biggest weak point and how should I drill it next session?`;
}

export async function deleteAiSession(id: string) {
  const user = await userOrThrow();
  await db.delete(schema.aiSessions).where(and(eq(schema.aiSessions.id, id), eq(schema.aiSessions.userId, user.id)));
  revalidatePath("/study/coach");
}

/* ───────── Judge ───────── */

function rubricFor(event: typeof schema.events.$inferSelect, withPresence: boolean): { items: RubricItem[]; basis: "verified" | "general" } {
  const items: RubricItem[] = event.rubric.length
    ? [...event.rubric]
    : [
        { id: "requirements", label: "Addresses the task", description: "Responds directly to what was asked." },
        { id: "content", label: "Content knowledge", description: "Accurate, relevant concepts." },
        { id: "communication", label: "Communication", description: "Clear, organized, professional." },
      ];
  if (withPresence) items.push({ id: "presence", label: "Presence and body language", description: "Posture, eye contact and confident presence (from camera stills)." });
  return { items, basis: event.rubricVerification === "verified" ? "verified" : "general" };
}

export async function startJudgeRun(mode: "standard" | "face"): Promise<AiResult<{ id: string }>> {
  const user = await userOrThrow();
  const sel = await activeSelection(user.id);
  if (!sel) return { ok: false, error: "Choose your event first." };
  const event = sel.event;
  const c = event.components;
  try {
    await guardBurst(user.id);
    const tz = user.profile!.timezone;
    const scenarioBased = Boolean(c.roleplay || c.caseStudy);
    const scenario = await withUsage(user.id, "judge_run", tz, async () => {
      if (scenarioBased) return await generateScenario(event);
      // Presentation/interview events: the student presents their own prepared work.
      return {
        title: `${event.name} practice round`,
        studentRole: "Competitor",
        judgeRole: "Event judge",
        situation: c.interview
          ? `You're in the interview round for ${event.name}. Introduce yourself and answer as you would for the judges.`
          : `Deliver your ${c.presentation?.label?.toLowerCase() ?? "presentation"} for ${event.name} as if the judges were in front of you.`,
        task: c.interview ? "Give a 1-minute introduction, then explain your strongest qualification with an example." : "Present your project: problem, solution, evidence and results. Then summarize in one sentence.",
        indicators: [],
        judgeQuestions: [],
      } satisfies Scenario;
    });
    const prep = (c.roleplay?.prepMinutes ?? c.caseStudy?.prepMinutes ?? 0) * 60;
    const perform = (c.roleplay?.performMinutes ?? c.caseStudy?.performMinutes ?? (c.presentation ? 10 : 5)) * 60;
    const [s] = await db
      .insert(schema.aiSessions)
      .values({
        userId: user.id,
        kind: mode === "face" ? "face_to_face" : "judge",
        eventId: event.id,
        title: scenario.title,
        scenario: { ...scenario, prepSec: prep, performSec: perform },
      })
      .returning({ id: schema.aiSessions.id });
    return { ok: true, data: { id: s.id } };
  } catch (e) {
    return fail(e);
  }
}

const SubmitSchema = z.object({
  transcript: z.string().trim().min(1, "Add your response first.").max(20000),
  durationSec: z.number().int().min(0).max(7200),
  images: z
    .array(z.object({ mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]), base64: z.string().max(1_500_000) }))
    .max(3)
    .optional(),
});

/** Scores a judge run. Retrying after a failure is free: the run was charged when the scenario was delivered. */
export async function submitJudgeRun(sessionId: string, input: z.infer<typeof SubmitSchema>): Promise<AiResult> {
  const user = await userOrThrow();
  const parsed = SubmitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    await guardBurst(user.id);
    const s = await ownedSession(user.id, sessionId);
    if (s.status === "scored") return { ok: true };
    const [event] = await db.select().from(schema.events).where(eq(schema.events.id, s.eventId!));
    const sc = s.scenario as Scenario & { performSec?: number };
    const images = parsed.data.images as ImageInput[] | undefined;
    const rubric = rubricFor(event, Boolean(images?.length));
    const context = `${sc.situation}\n\nTask: ${sc.task}${sc.indicators?.length ? `\nPerformance indicators: ${sc.indicators.join("; ")}` : ""}`;
    const result = await evaluatePerformance({
      event,
      rubric: rubric.items,
      rubricBasis: rubric.basis,
      context,
      response: parsed.data.transcript,
      durationSec: parsed.data.durationSec,
      timeLimitSec: sc.performSec,
      images,
    });
    // Images are used for this evaluation only and are never stored.
    await db.insert(schema.aiMessages).values({ sessionId: s.id, role: "user", content: parsed.data.transcript });
    await db.insert(schema.aiFeedback).values({
      sessionId: s.id,
      userId: user.id,
      eventId: event.id,
      score: result.score,
      criteria: result.criteria,
      summary: result.summary + (result.strengths.length ? `\n\nStrengths: ${result.strengths.join("; ")}` : ""),
      nextSteps: result.nextSteps,
      rubricBasis: rubric.basis,
    });
    await db.update(schema.aiSessions).set({ status: "scored", updatedAt: new Date() }).where(eq(schema.aiSessions.id, s.id));
    const tz = user.profile!.timezone;
    await awardXp(user.id, XP.judgeRun, "judge", s.id);
    await recordActivity(user.id, tz);
    await autoCompleteTask(user.id, tz, ["judge"]);
    await syncAchievements(user.id, tz);
    revalidatePath(`/study/judge/${s.id}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ───────── Judge questions ───────── */

export async function startJudgeQuestions(): Promise<AiResult<{ id: string }>> {
  const user = await userOrThrow();
  const sel = await activeSelection(user.id);
  if (!sel) return { ok: false, error: "Choose your event first." };
  try {
    await guardBurst(user.id);
    const out = await withUsage(user.id, "judge_questions", user.profile!.timezone, () => likelyQuestions(sel.event));
    const [s] = await db
      .insert(schema.aiSessions)
      .values({ userId: user.id, kind: "judge_questions", eventId: sel.event.id, title: `${sel.event.code} judge questions`, scenario: { questions: out.questions, answers: {} } })
      .returning({ id: schema.aiSessions.id });
    return { ok: true, data: { id: s.id } };
  } catch (e) {
    return fail(e);
  }
}

export async function answerJudgeQuestion(sessionId: string, index: number, answer: string): Promise<AiResult<{ rating: number; feedback: string; strongerAnswer: string }>> {
  const user = await userOrThrow();
  const a = z.string().trim().min(1).max(4000).safeParse(answer);
  if (!a.success) return { ok: false, error: "Add your answer first." };
  try {
    await guardBurst(user.id);
    const s = await ownedSession(user.id, sessionId);
    const sc = s.scenario as { questions: string[]; answers: Record<string, unknown> };
    if (!sc.questions[index]) return { ok: false, error: "Question not found." };
    const [event] = await db.select().from(schema.events).where(eq(schema.events.id, s.eventId!));
    const fb = await rateAnswer(event, sc.questions[index], a.data);
    sc.answers[index] = { answer: a.data, ...fb };
    await db.update(schema.aiSessions).set({ scenario: sc, updatedAt: new Date() }).where(eq(schema.aiSessions.id, s.id));
    if (Object.keys(sc.answers).length === 1) {
      await recordActivity(user.id, user.profile!.timezone);
      await awardXp(user.id, XP.explainBack, "judge_questions", s.id);
    }
    return { ok: true, data: fb };
  } catch (e) {
    return fail(e);
  }
}

/* ───────── Explain it back ───────── */

export async function explainBack(cardId: string, explanation: string): Promise<AiResult<{ verdict: "got_it" | "close" | "not_yet"; feedback: string; definition: string }>> {
  const user = await userOrThrow();
  const text = z.string().trim().min(3, "Explain the term in a sentence or two.").max(2000).safeParse(explanation);
  if (!text.success) return { ok: false, error: text.error.issues[0].message };
  const [card] = await db.select().from(schema.flashcards).where(eq(schema.flashcards.id, cardId));
  if (!card) return { ok: false, error: "Term not found." };
  try {
    await guardBurst(user.id);
    const tz = user.profile!.timezone;
    const out = await withUsage(user.id, "explain_back", tz, () => checkExplanation(card.term, card.definition, text.data));
    await db
      .insert(schema.aiSessions)
      .values({ userId: user.id, kind: "explain", title: card.term, status: "scored", scenario: { cardId, verdict: out.verdict } });
    await recordActivity(user.id, tz);
    if (out.verdict === "got_it") await awardXp(user.id, XP.explainBack, "explain", `${card.id}:${new Date().toISOString().slice(0, 10)}`);
    return { ok: true, data: { ...out, definition: card.definition } };
  } catch (e) {
    return fail(e);
  }
}

/* ───────── Entry / presentation checks ───────── */

export async function runCheck(type: "entry" | "presentation", text: string): Promise<AiResult<{ id: string }>> {
  const user = await userOrThrow();
  const body = z.string().trim().min(200, "Paste at least a few paragraphs so there's enough to review.").max(30000, "That's longer than 30,000 characters. Paste one section at a time.").safeParse(text);
  if (!body.success) return { ok: false, error: body.error.issues[0].message };
  const sel = await activeSelection(user.id);
  if (!sel) return { ok: false, error: "Choose your event first." };
  const event = sel.event;
  try {
    await guardBurst(user.id);
    const tz = user.profile!.timezone;
    const rubric = rubricFor(event, false);
    const feature = type === "entry" ? "entry_check" : "presentation_check";
    const result = await withUsage(user.id, feature, tz, () =>
      evaluatePerformance({
        event,
        rubric: rubric.items,
        rubricBasis: rubric.basis,
        context:
          type === "entry"
            ? `Review this written entry draft for ${event.name}. Judge it as a written document: completeness against the event's written requirements, clarity, evidence and professionalism.`
            : `Review this presentation outline or script for ${event.name}. Judge organization, persuasiveness, use of evidence and how well it would hold up to judge questions.`,
        response: body.data,
      }),
    );
    const [s] = await db
      .insert(schema.aiSessions)
      .values({ userId: user.id, kind: `${type}_check`, eventId: event.id, title: `${type === "entry" ? "Entry" : "Presentation"} check`, status: "scored" })
      .returning({ id: schema.aiSessions.id });
    await db.insert(schema.aiFeedback).values({ sessionId: s.id, userId: user.id, eventId: event.id, score: result.score, criteria: result.criteria, summary: result.summary, nextSteps: result.nextSteps, rubricBasis: rubric.basis });
    await recordActivity(user.id, tz);
    await autoCompleteTask(user.id, tz, [type]);
    return { ok: true, data: { id: s.id } };
  } catch (e) {
    return fail(e);
  }
}

export async function goToSession(id: string) {
  redirect(`/study/judge/${id}`);
}

export async function recentSessions(kinds: string[]) {
  const user = await userOrThrow();
  return db
    .select({ id: schema.aiSessions.id, title: schema.aiSessions.title, updatedAt: schema.aiSessions.updatedAt })
    .from(schema.aiSessions)
    .where(and(eq(schema.aiSessions.userId, user.id), inArray(schema.aiSessions.kind, kinds)))
    .orderBy(desc(schema.aiSessions.updatedAt))
    .limit(20);
}
