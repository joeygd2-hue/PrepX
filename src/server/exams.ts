import "server-only";
import { and, desc, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { XP } from "@/lib/levels";
import { awardXp, recordActivity, syncAchievements } from "./progress";
import { autoCompleteTask } from "./dashboard";
import { commitUsage, refundUsage, reserveUsage } from "./entitlements";

export const MODES = {
  quick10: { label: "Quick 10", instant: true, count: 10 },
  full: { label: "Full practice exam", instant: false, count: 100 },
  rehearsal: { label: "Test-day rehearsal", instant: false, count: 100 },
  sprint: { label: "60-second sprint", instant: true, count: 40 },
  mistakes: { label: "Mistake notebook", instant: true, count: 20 },
  unit: { label: "Unit practice", instant: true, count: 10 },
  check: { label: "Lesson check", instant: true, count: 3 },
} as const;
export type Mode = keyof typeof MODES;
export const isMode = (m: unknown): m is Mode => typeof m === "string" && m in MODES;

export class ExamError extends Error {}

function shuffle<T>(a: T[]) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

/** Prefers questions the student hasn't seen, then ones they missed, then the rest. */
async function pickQuestions(userId: string, clusterId: string, n: number, unitId?: string) {
  const pool = await db
    .select({ id: schema.questions.id })
    .from(schema.questions)
    .where(and(eq(schema.questions.clusterId, clusterId), eq(schema.questions.status, "published"), unitId ? eq(schema.questions.unitId, unitId) : undefined));
  const seen = await db
    .select({ id: schema.attemptAnswers.questionId, correct: sql<boolean>`bool_and(${schema.attemptAnswers.correct})` })
    .from(schema.attemptAnswers)
    .where(and(eq(schema.attemptAnswers.userId, userId), inArray(schema.attemptAnswers.questionId, pool.length ? pool.map((p) => p.id) : ["00000000-0000-0000-0000-000000000000"])))
    .groupBy(schema.attemptAnswers.questionId);
  const seenMap = new Map(seen.map((s) => [s.id, s.correct]));
  const unseen = shuffle(pool.filter((p) => !seenMap.has(p.id)));
  const missed = shuffle(pool.filter((p) => seenMap.get(p.id) === false));
  const rest = shuffle(pool.filter((p) => seenMap.get(p.id) === true));
  return [...unseen, ...missed, ...rest].slice(0, n).map((p) => p.id);
}

export async function startAttempt(opts: { userId: string; tz: string; clusterId: string; mode: Mode; eventId?: string | null; unitId?: string | null }) {
  const { userId, clusterId, mode } = opts;
  const [cluster] = await db.select().from(schema.examClusters).where(eq(schema.examClusters.id, clusterId));
  if (!cluster) throw new ExamError("Exam not found.");

  // Resume an unfinished attempt of the same kind instead of starting over.
  if (mode !== "sprint" && mode !== "check") {
    const [open] = await db
      .select({ id: schema.examAttempts.id })
      .from(schema.examAttempts)
      .where(
        and(
          eq(schema.examAttempts.userId, userId),
          eq(schema.examAttempts.clusterId, clusterId),
          eq(schema.examAttempts.mode, mode),
          isNull(schema.examAttempts.submittedAt),
          opts.unitId ? eq(schema.examAttempts.unitId, opts.unitId) : undefined,
        ),
      )
      .orderBy(desc(schema.examAttempts.startedAt))
      .limit(1);
    if (open) return open.id;
  }

  let ids: string[];
  if (mode === "mistakes") {
    const rows = await db
      .select({ id: schema.mistakes.questionId })
      .from(schema.mistakes)
      .innerJoin(schema.questions, eq(schema.questions.id, schema.mistakes.questionId))
      .where(and(eq(schema.mistakes.userId, userId), isNull(schema.mistakes.clearedAt), eq(schema.questions.clusterId, clusterId)))
      .orderBy(desc(schema.mistakes.lastMissedAt))
      .limit(MODES.mistakes.count);
    ids = shuffle(rows.map((r) => r.id));
    if (!ids.length) throw new ExamError("Your mistake notebook is empty. Nice work!");
  } else if (mode === "check") {
    if (!opts.unitId) throw new ExamError("Unit required.");
    const rows = await db
      .select({ id: schema.questions.id })
      .from(schema.questions)
      .where(and(eq(schema.questions.unitId, opts.unitId), eq(schema.questions.status, "published")))
      .orderBy(schema.questions.createdAt, schema.questions.id)
      .limit(3);
    ids = rows.map((r) => r.id);
  } else {
    const n = mode === "full" || mode === "rehearsal" ? (cluster.questionCount ?? 100) : MODES[mode].count;
    ids = await pickQuestions(userId, clusterId, n, mode === "unit" ? (opts.unitId ?? undefined) : undefined);
  }
  if (!ids.length) throw new ExamError("There are no practice questions for this exam yet.");

  let usageId: string | null = null;
  if (mode === "full" || mode === "rehearsal") usageId = await reserveUsage(userId, "full_exam", opts.tz);
  try {
    const timeLimitSec =
      mode === "sprint" ? 60 : mode === "full" || mode === "rehearsal" ? Math.round(((cluster.minutes ?? 60) * 60 * ids.length) / (cluster.questionCount ?? ids.length)) : null;
    const [row] = await db
      .insert(schema.examAttempts)
      .values({ userId, clusterId, eventId: opts.eventId ?? null, mode, unitId: opts.unitId ?? null, questionIds: ids, timeLimitSec, allowPause: mode !== "rehearsal" && mode !== "sprint" })
      .returning({ id: schema.examAttempts.id });
    if (usageId) await commitUsage(usageId);
    return row.id;
  } catch (e) {
    if (usageId) await refundUsage(usageId);
    throw e;
  }
}

async function ownedAttempt(userId: string, attemptId: string) {
  const [a] = await db.select().from(schema.examAttempts).where(and(eq(schema.examAttempts.id, attemptId), eq(schema.examAttempts.userId, userId)));
  if (!a) throw new ExamError("Attempt not found.");
  return a;
}

/** Questions for the client. Answers and explanations are never sent before grading in exam modes. */
export async function loadAttempt(userId: string, attemptId: string) {
  const a = await ownedAttempt(userId, attemptId);
  const qs = await db.select().from(schema.questions).where(inArray(schema.questions.id, a.questionIds));
  const byId = new Map(qs.map((q) => [q.id, q]));
  const answered = await db.select().from(schema.attemptAnswers).where(eq(schema.attemptAnswers.attemptId, a.id));
  const ansMap = new Map(answered.map((x) => [x.questionId, x]));
  const instant = MODES[a.mode as Mode]?.instant ?? true;
  return {
    attempt: a,
    questions: a.questionIds
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((q) => {
        const prior = ansMap.get(q!.id);
        return {
          id: q!.id,
          stem: q!.stem,
          choices: q!.choices,
          source: q!.source,
          // In instant modes, already-answered questions reveal their feedback on resume.
          answered: instant && prior ? { chosen: prior.chosenIndex, correct: prior.correct, answerIndex: q!.answerIndex, explanation: q!.explanation } : null,
        };
      }),
  };
}

async function applyAnswer(userId: string, attemptId: string, q: typeof schema.questions.$inferSelect, chosen: number | null) {
  const correct = chosen === q.answerIndex;
  const inserted = await db
    .insert(schema.attemptAnswers)
    .values({ attemptId, questionId: q.id, userId, chosenIndex: chosen, correct })
    .onConflictDoNothing()
    .returning();
  if (!inserted.length) return { correct, duplicate: true };
  if (!correct) {
    await db
      .insert(schema.mistakes)
      .values({ userId, questionId: q.id })
      .onConflictDoUpdate({ target: [schema.mistakes.userId, schema.mistakes.questionId], set: { misses: sql`${schema.mistakes.misses} + 1`, correctStreak: 0, clearedAt: null, lastMissedAt: new Date() } });
  } else {
    await db.execute(sql`update mistakes set correct_streak = correct_streak + 1,
      cleared_at = case when correct_streak + 1 >= 2 then now() else cleared_at end
      where user_id = ${userId} and question_id = ${q.id} and cleared_at is null`);
  }
  await awardXp(userId, XP.questionAnswered + (correct ? XP.questionCorrect : 0), "question", `${attemptId}:${q.id}`);
  return { correct, duplicate: false };
}

/** Instant-feedback modes: record one answer and reveal the explanation. */
export async function answerInstant(userId: string, attemptId: string, questionId: string, chosen: number) {
  const a = await ownedAttempt(userId, attemptId);
  if (a.submittedAt) throw new ExamError("This attempt is already finished.");
  if (!MODES[a.mode as Mode]?.instant) throw new ExamError("Answers are revealed after you submit.");
  if (!a.questionIds.includes(questionId)) throw new ExamError("Question not in this attempt.");
  if (a.timeLimitSec && Date.now() - a.startedAt.getTime() > (a.timeLimitSec + 5) * 1000) throw new ExamError("Time's up.");
  const [q] = await db.select().from(schema.questions).where(eq(schema.questions.id, questionId));
  const r = await applyAnswer(userId, a.id, q, chosen);
  return { correct: r.correct, answerIndex: q.answerIndex, explanation: q.explanation };
}

export async function saveDraft(userId: string, attemptId: string, draft: Record<string, number>, elapsedSec: number) {
  const a = await ownedAttempt(userId, attemptId);
  if (a.submittedAt) return;
  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries(draft)) if (a.questionIds.includes(k) && Number.isInteger(v) && v >= 0 && v < 6) clean[k] = v;
  await db
    .update(schema.examAttempts)
    .set({ draft: clean, elapsedSec: Math.max(a.elapsedSec, Math.min(Math.round(elapsedSec), a.timeLimitSec ?? 1e6)) })
    .where(eq(schema.examAttempts.id, a.id));
}

export async function submitAttempt(userId: string, tz: string, attemptId: string, draft?: Record<string, number>, elapsedSec?: number) {
  const a = await ownedAttempt(userId, attemptId);
  if (a.submittedAt) return a.id;
  if (draft) await saveDraft(userId, attemptId, draft, elapsedSec ?? a.elapsedSec);
  const fresh = await ownedAttempt(userId, attemptId);
  const instant = MODES[a.mode as Mode]?.instant ?? true;
  const qs = await db.select().from(schema.questions).where(inArray(schema.questions.id, a.questionIds));
  if (!instant) {
    for (const q of qs) await applyAnswer(userId, a.id, q, fresh.draft[q.id] ?? null);
  }
  const answers = await db.select().from(schema.attemptAnswers).where(eq(schema.attemptAnswers.attemptId, a.id));
  const correct = answers.filter((x) => x.correct).length;
  const total = a.mode === "sprint" ? answers.length : a.questionIds.length;
  await db.update(schema.examAttempts).set({ submittedAt: new Date(), correct, total }).where(eq(schema.examAttempts.id, a.id));

  if (answers.length) {
    await recordActivity(userId, tz);
    const kinds: Record<string, string[]> = { quick10: ["quick10"], full: ["exam"], rehearsal: ["rehearsal", "exam"], sprint: ["sprint"], mistakes: ["mistakes"], unit: ["quick10"], check: ["lesson"] };
    await autoCompleteTask(userId, tz, kinds[a.mode] ?? []);
  }
  if (a.mode === "full" || a.mode === "rehearsal") await awardXp(userId, XP.examSubmitted, "exam", a.id);
  if (a.mode === "sprint") {
    await db
      .insert(schema.sprintBests)
      .values({ userId, clusterId: a.clusterId, best: correct })
      .onConflictDoUpdate({ target: [schema.sprintBests.userId, schema.sprintBests.clusterId], set: { best: sql`greatest(${schema.sprintBests.best}, ${correct})`, achievedAt: sql`case when ${correct} > ${schema.sprintBests.best} then now() else ${schema.sprintBests.achievedAt} end` } });
  }
  if (a.mode === "check" && a.unitId) {
    await db
      .insert(schema.lessonProgress)
      .values({ userId, unitId: a.unitId, lessonCompletedAt: new Date(), checkCorrect: correct })
      .onConflictDoUpdate({ target: [schema.lessonProgress.userId, schema.lessonProgress.unitId], set: { lessonCompletedAt: sql`coalesce(${schema.lessonProgress.lessonCompletedAt}, now())`, checkCorrect: correct } });
    await awardXp(userId, XP.lessonComplete, "lesson", a.unitId);
  }
  await syncAchievements(userId, tz);
  return a.id;
}

export async function attemptReview(userId: string, attemptId: string) {
  const a = await ownedAttempt(userId, attemptId);
  if (!a.submittedAt) throw new ExamError("Submit the attempt to see the review.");
  const qs = await db
    .select({ q: schema.questions, unitTitle: schema.units.title })
    .from(schema.questions)
    .leftJoin(schema.units, eq(schema.units.id, schema.questions.unitId))
    .where(inArray(schema.questions.id, a.questionIds));
  const answers = await db.select().from(schema.attemptAnswers).where(eq(schema.attemptAnswers.attemptId, a.id));
  const ansMap = new Map(answers.map((x) => [x.questionId, x]));
  const byId = new Map(qs.map((r) => [r.q.id, r]));
  const items = a.questionIds
    .map((id) => byId.get(id))
    .filter(Boolean)
    .filter((r) => a.mode !== "sprint" || ansMap.has(r!.q.id))
    .map((r) => ({ ...r!.q, unitTitle: r!.unitTitle ?? "General", answer: ansMap.get(r!.q.id) ?? null }));
  const topics = new Map<string, { total: number; correct: number }>();
  for (const it of items) {
    const t = topics.get(it.unitTitle) ?? { total: 0, correct: 0 };
    t.total++;
    if (it.answer?.correct) t.correct++;
    topics.set(it.unitTitle, t);
  }
  const [previous] = await db
    .select()
    .from(schema.examAttempts)
    .where(
      and(
        eq(schema.examAttempts.userId, userId),
        eq(schema.examAttempts.clusterId, a.clusterId),
        eq(schema.examAttempts.mode, a.mode),
        notInArray(schema.examAttempts.id, [a.id]),
        sql`${schema.examAttempts.submittedAt} < ${a.submittedAt}`,
      ),
    )
    .orderBy(desc(schema.examAttempts.submittedAt))
    .limit(1);
  const [best] = a.mode === "sprint" ? await db.select().from(schema.sprintBests).where(and(eq(schema.sprintBests.userId, userId), eq(schema.sprintBests.clusterId, a.clusterId))) : [];
  return { attempt: a, items, topics: [...topics.entries()].map(([title, t]) => ({ title, ...t })), previous: previous ?? null, sprintBest: best?.best ?? null };
}
