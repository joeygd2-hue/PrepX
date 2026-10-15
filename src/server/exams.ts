import "server-only";
import { and, desc, eq, inArray, isNull, lt, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
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
  bookmarks: { label: "Bookmarked questions", instant: true, count: 20 },
  duel: { label: "Head-to-head duel", instant: true, count: 10 },
} as const;
export type Mode = keyof typeof MODES;
export const isMode = (m: unknown): m is Mode => typeof m === "string" && m in MODES;

export class ExamError extends Error {}

function shuffle<T>(a: T[], rng: () => number = Math.random) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
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

const DAY_MS = 86_400_000;
/** Questions answered this recently are only reused when nothing fresher is left. */
export const ADAPTIVE_RECENT_DAYS = 3;
/** How many of a unit's latest answers decide its "recent accuracy". */
const UNIT_WINDOW = 20;

export type AdaptiveInput = {
  /** Published questions of the bank. */
  pool: { id: string; unitId: string | null }[];
  /** The student's answers in this bank (any order). */
  answers: { questionId: string; correct: boolean; answeredAt: Date }[];
  /** Question ids in the student's open mistake notebook, most recent miss first. */
  openMistakes: string[];
  n: number;
  now?: Date;
  rng?: () => number;
};

/**
 * Adaptive Quick 10, as a pure function so it can be tested with a seeded random source.
 *
 * - Each unit gets a weight: 1 when the student has no answers there, otherwise
 *   0.25 + 0.75 × (share missed among its latest answers). Slots go to the unit with the highest
 *   weight ÷ (1 + questions it already has) (a little jitter breaks ties), so weak and unseen
 *   units get more questions while the set still spreads; a brand-new student gets one question
 *   per unit before any unit gets a second.
 * - About two open mistakes are included when the student has any (stale ones first).
 * - Within a unit: never-seen questions first, then previously missed, then the rest. Questions
 *   answered in the last few days are only used once nothing else is left in the bank.
 * - No question appears twice; a bank smaller than `n` simply returns every question.
 */
export function selectAdaptiveQuestions({ pool, answers, openMistakes, n, now = new Date(), rng = Math.random }: AdaptiveInput): string[] {
  const unitOf = new Map(pool.map((q) => [q.id, q.unitId ?? ""]));
  if (!unitOf.size || n <= 0) return [];
  const lastAt = new Map<string, number>();
  const missed = new Set<string>();
  const unitStats = new Map<string, { total: number; correct: number }>();
  for (const a of [...answers].sort((x, y) => y.answeredAt.getTime() - x.answeredAt.getTime())) {
    if (!lastAt.has(a.questionId)) lastAt.set(a.questionId, a.answeredAt.getTime());
    if (!a.correct) missed.add(a.questionId);
    const unit = unitOf.get(a.questionId);
    if (unit === undefined) continue;
    const s = unitStats.get(unit) ?? { total: 0, correct: 0 };
    if (s.total < UNIT_WINDOW) {
      s.total++;
      if (a.correct) s.correct++;
    }
    unitStats.set(unit, s);
  }
  const weight = (unit: string) => {
    const s = unitStats.get(unit);
    return s?.total ? 0.25 + 0.75 * (1 - s.correct / s.total) : 1;
  };
  const cutoff = now.getTime() - ADAPTIVE_RECENT_DAYS * DAY_MS;
  const isRecent = (id: string) => (lastAt.get(id) ?? 0) > cutoff;

  const picked: string[] = [];
  const perUnit = new Map<string, number>();
  const take = (id: string) => {
    picked.push(id);
    const unit = unitOf.get(id)!;
    perUnit.set(unit, (perUnit.get(unit) ?? 0) + 1);
  };

  // About two open mistakes, preferring ones not answered in the last few days (stable sort keeps the shuffle).
  const mistakes = shuffle([...new Set(openMistakes)].filter((id) => unitOf.has(id)), rng).sort((x, y) => Number(isRecent(x)) - Number(isRecent(y)));
  for (const id of mistakes.slice(0, Math.min(2, Math.floor(n / 3)))) take(id);

  const queues = new Map<string, { fresh: string[]; recent: string[] }>();
  for (const id of shuffle([...unitOf.keys()], rng)) {
    if (picked.includes(id)) continue;
    const unit = unitOf.get(id)!;
    const q = queues.get(unit) ?? { fresh: [], recent: [] };
    (isRecent(id) ? q.recent : q.fresh).push(id);
    queues.set(unit, q);
  }
  const tier = (id: string) => (!lastAt.has(id) ? 0 : missed.has(id) ? 1 : 2);
  for (const q of queues.values()) {
    q.fresh.sort((x, y) => tier(x) - tier(y));
    q.recent.sort((x, y) => lastAt.get(x)! - lastAt.get(y)!);
  }
  for (const key of ["fresh", "recent"] as const) {
    while (picked.length < n) {
      let best: string[] | null = null;
      let bestScore = -1;
      for (const [unit, q] of queues) {
        if (!q[key].length) continue;
        const score = (weight(unit) * (0.9 + 0.2 * rng())) / (1 + (perUnit.get(unit) ?? 0));
        if (score > bestScore) {
          bestScore = score;
          best = q[key];
        }
      }
      if (!best) break;
      take(best.shift()!);
    }
  }
  return shuffle(picked, rng);
}

async function pickAdaptive(userId: string, clusterId: string, n: number) {
  const pool = await db
    .select({ id: schema.questions.id, unitId: schema.questions.unitId })
    .from(schema.questions)
    .where(and(eq(schema.questions.clusterId, clusterId), eq(schema.questions.status, "published")));
  const answers = await db
    .select({ questionId: schema.attemptAnswers.questionId, correct: schema.attemptAnswers.correct, answeredAt: schema.attemptAnswers.answeredAt })
    .from(schema.attemptAnswers)
    .innerJoin(schema.questions, eq(schema.questions.id, schema.attemptAnswers.questionId))
    .where(and(eq(schema.attemptAnswers.userId, userId), eq(schema.questions.clusterId, clusterId)))
    .orderBy(desc(schema.attemptAnswers.answeredAt))
    .limit(2000);
  const open = await db
    .select({ id: schema.mistakes.questionId })
    .from(schema.mistakes)
    .innerJoin(schema.questions, eq(schema.questions.id, schema.mistakes.questionId))
    .where(and(eq(schema.mistakes.userId, userId), isNull(schema.mistakes.clearedAt), eq(schema.questions.clusterId, clusterId), eq(schema.questions.status, "published")))
    .orderBy(desc(schema.mistakes.lastMissedAt))
    .limit(50);
  return selectAdaptiveQuestions({ pool, answers, openMistakes: open.map((m) => m.id), n });
}

/**
 * Starts (or resumes) a practice attempt. `questionIds` fixes the question list (duels use it
 * so both players get the same questions); those ids must be published questions of the bank.
 */
export async function startAttempt(opts: { userId: string; tz: string; clusterId: string; mode: Mode; eventId?: string | null; unitId?: string | null; questionIds?: string[] }) {
  const { userId, clusterId, mode } = opts;
  const [cluster] = await db.select().from(schema.examClusters).where(eq(schema.examClusters.id, clusterId));
  if (!cluster) throw new ExamError("Exam not found.");

  // Resume an unfinished attempt of the same kind instead of starting over.
  if (mode !== "sprint" && mode !== "check" && !opts.questionIds) {
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
  if (opts.questionIds) {
    const valid = await db
      .select({ id: schema.questions.id })
      .from(schema.questions)
      .where(and(inArray(schema.questions.id, opts.questionIds), eq(schema.questions.clusterId, clusterId), eq(schema.questions.status, "published")));
    const ok = new Set(valid.map((r) => r.id));
    ids = opts.questionIds.filter((id) => ok.has(id));
    if (ids.length !== opts.questionIds.length) throw new ExamError("Some of these questions are no longer available.");
  } else if (mode === "mistakes") {
    const rows = await db
      .select({ id: schema.mistakes.questionId })
      .from(schema.mistakes)
      .innerJoin(schema.questions, eq(schema.questions.id, schema.mistakes.questionId))
      .where(and(eq(schema.mistakes.userId, userId), isNull(schema.mistakes.clearedAt), eq(schema.questions.clusterId, clusterId)))
      .orderBy(desc(schema.mistakes.lastMissedAt))
      .limit(MODES.mistakes.count);
    ids = shuffle(rows.map((r) => r.id));
    if (!ids.length) throw new ExamError("Your mistake notebook is empty. Nice work!");
  } else if (mode === "bookmarks") {
    const rows = await db
      .select({ id: schema.questionBookmarks.questionId })
      .from(schema.questionBookmarks)
      .innerJoin(schema.questions, eq(schema.questions.id, schema.questionBookmarks.questionId))
      .where(and(eq(schema.questionBookmarks.userId, userId), eq(schema.questions.clusterId, clusterId), eq(schema.questions.status, "published")))
      .orderBy(sql`random()`)
      .limit(MODES.bookmarks.count);
    ids = rows.map((r) => r.id);
    if (!ids.length) throw new ExamError("You haven't bookmarked any questions in this bank yet. Tap the bookmark on a question after you answer it to save it for later.");
  } else if (mode === "check") {
    if (!opts.unitId) throw new ExamError("Unit required.");
    const rows = await db
      .select({ id: schema.questions.id })
      .from(schema.questions)
      .where(and(eq(schema.questions.unitId, opts.unitId), eq(schema.questions.status, "published")))
      .orderBy(schema.questions.createdAt, schema.questions.id)
      .limit(3);
    ids = rows.map((r) => r.id);
  } else if (mode === "quick10") {
    ids = await pickAdaptive(userId, clusterId, MODES.quick10.count);
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

const AttemptId = z.uuid();

async function ownedAttempt(userId: string, attemptId: string) {
  // A malformed id (hand-edited URL, tampered action call) is "not found", not a database error.
  if (!AttemptId.safeParse(attemptId).success) throw new ExamError("Attempt not found.");
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
  if (!q) throw new ExamError("This question is no longer available.");
  if (!Number.isInteger(chosen) || chosen < 0 || chosen >= q.choices.length) throw new ExamError("Pick one of the answer choices.");
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
    const kinds: Record<string, string[]> = { quick10: ["quick10"], full: ["exam"], rehearsal: ["rehearsal", "exam"], sprint: ["sprint"], mistakes: ["mistakes"], unit: ["quick10"], check: ["lesson"], bookmarks: ["quick10"] };
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
        lt(schema.examAttempts.submittedAt, a.submittedAt),
      ),
    )
    .orderBy(desc(schema.examAttempts.submittedAt))
    .limit(1);
  const [best] = a.mode === "sprint" ? await db.select().from(schema.sprintBests).where(and(eq(schema.sprintBests.userId, userId), eq(schema.sprintBests.clusterId, a.clusterId))) : [];
  // A duel attempt links back to its own duel's results.
  const [duel] =
    a.mode === "duel"
      ? await db
          .select({ id: schema.duelEntries.duelId })
          .from(schema.duelEntries)
          .where(and(eq(schema.duelEntries.attemptId, a.id), eq(schema.duelEntries.userId, userId)))
          .limit(1)
      : [];
  return { attempt: a, items, topics: [...topics.entries()].map(([title, t]) => ({ title, ...t })), previous: previous ?? null, sprintBest: best?.best ?? null, duelId: duel?.id ?? null };
}
