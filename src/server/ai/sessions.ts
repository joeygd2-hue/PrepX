import "server-only";
import { and, eq, inArray, lt, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";

/** Session kinds that `submitJudgeRun` scores. */
export const JUDGE_KINDS = ["judge", "face_to_face"];

/** Answer feedback for a judge-questions set stays open this long. The set itself is charged once, when it's generated. */
export const ANSWER_WINDOW_HOURS = 24;

/**
 * A claim left behind by a request that died mid-call (crash, platform timeout) can be taken
 * over after this long. Well past the AI timeout plus one retry, so a live call is never doubled.
 */
const STALE_CLAIM_MINUTES = 10;

/** The session can't take this request in its current state. The message is shown to the student. */
export class SessionStateError extends Error {}

export function answerWindowOpen(createdAt: Date) {
  return createdAt.getTime() > Date.now() - ANSWER_WINDOW_HOURS * 3600_000;
}

/**
 * Atomically moves the student's open judge round to "scoring" so only one request can
 * call the model for it. Returns the session, or null when it has already been scored.
 */
export async function claimJudgeRun(userId: string, sessionId: string) {
  const s = schema.aiSessions;
  const [claimed] = await db
    .update(s)
    .set({ status: "scoring", updatedAt: sql`now()` })
    .where(
      and(
        eq(s.id, sessionId),
        eq(s.userId, userId),
        inArray(s.kind, JUDGE_KINDS),
        or(eq(s.status, "open"), and(eq(s.status, "scoring"), lt(s.updatedAt, sql`now() - make_interval(mins => ${STALE_CLAIM_MINUTES})`))),
      ),
    )
    .returning();
  if (claimed) return claimed;
  const [current] = await db.select({ kind: s.kind, status: s.status }).from(s).where(and(eq(s.id, sessionId), eq(s.userId, userId)));
  if (!current) throw new Error("Session not found");
  if (!JUDGE_KINDS.includes(current.kind)) throw new SessionStateError("This isn't a judge practice round, so it can't be scored here.");
  if (current.status === "scored") return null;
  if (current.status === "scoring") throw new SessionStateError("This round is already being scored. Wait a moment, then try again.");
  throw new SessionStateError("This round can't be scored. Start a new practice round.");
}

/** Hands a claimed round back so a retry after a failed AI call stays free. A no-op once it's scored. */
export async function releaseJudgeRun(sessionId: string) {
  await db
    .update(schema.aiSessions)
    .set({ status: "open" })
    .where(and(eq(schema.aiSessions.id, sessionId), eq(schema.aiSessions.status, "scoring")));
}

/**
 * Atomically claims feedback for one question of the student's judge-questions set: one
 * feedback per question, only while the set is under a day old. Concurrent requests for the
 * same question get a SessionStateError instead of a second model call.
 */
export async function claimAnswer(userId: string, sessionId: string, index: number) {
  // Sets hold at most 20 questions; the upper bound keeps the SQL int cast in range.
  if (!Number.isInteger(index) || index < 0 || index > 999) throw new SessionStateError("Question not found.");
  const key = String(index);
  const rows = await db.execute<{ question: string; event_id: string | null }>(sql`
    update ai_sessions
    set scenario = jsonb_set(scenario, '{claims}', coalesce(scenario->'claims', '{}'::jsonb) || jsonb_build_object(${key}::text, now()))
    where id = ${sessionId}
      and user_id = ${userId}
      and kind = 'judge_questions'
      and created_at > now() - make_interval(hours => ${ANSWER_WINDOW_HOURS})
      and scenario->'questions'->>${index}::int is not null
      and scenario->'answers'->${key}::text is null
      and coalesce((scenario->'claims'->>${key}::text)::timestamptz, '-infinity') < now() - make_interval(mins => ${STALE_CLAIM_MINUTES})
    returning scenario->'questions'->>${index}::int as question, event_id`);
  const claimed = rows[0];
  if (claimed) return { question: claimed.question, eventId: claimed.event_id };

  const s = schema.aiSessions;
  const [current] = await db
    .select({ kind: s.kind, scenario: s.scenario, open: sql<boolean>`${s.createdAt} > now() - make_interval(hours => ${ANSWER_WINDOW_HOURS})` })
    .from(s)
    .where(and(eq(s.id, sessionId), eq(s.userId, userId)));
  if (!current) throw new Error("Session not found");
  if (current.kind !== "judge_questions") throw new SessionStateError("This isn't a judge questions set.");
  const sc = (current.scenario ?? {}) as { questions?: string[]; answers?: Record<string, unknown> };
  if (!sc.questions?.[index]) throw new SessionStateError("Question not found.");
  if (sc.answers?.[key]) throw new SessionStateError("You've already had feedback on this question. Try the next one, or start a new set.");
  if (!current.open) throw new SessionStateError("This set is more than a day old, so feedback has closed. Generate a new set to keep practicing.");
  throw new SessionStateError("Feedback on this question is already on its way. Give it a moment.");
}

/** Stores the rated answer and drops the claim. Returns how many questions in the set now have feedback. */
export async function saveAnswer(sessionId: string, index: number, value: Record<string, unknown>) {
  const key = String(index);
  const rows = await db.execute<{ answered: number }>(sql`
    update ai_sessions
    set scenario = jsonb_set(scenario #- array['claims', ${key}::text], '{answers}', coalesce(scenario->'answers', '{}'::jsonb) || jsonb_build_object(${key}::text, ${JSON.stringify(value)}::jsonb)),
        updated_at = now()
    where id = ${sessionId}
    returning (select count(*) from jsonb_object_keys(ai_sessions.scenario->'answers'))::int as answered`);
  return Number(rows[0]?.answered ?? 0);
}

/** Drops a claim after a failed AI call so the student can try that question again. */
export async function releaseAnswer(sessionId: string, index: number) {
  await db.execute(sql`update ai_sessions set scenario = scenario #- array['claims', ${String(index)}::text] where id = ${sessionId}`);
}
