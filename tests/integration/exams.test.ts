import { describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { answerInstant, attemptReview, ExamError, loadAttempt, saveDraft, selectAdaptiveQuestions, startAttempt, submitAttempt, type AdaptiveInput } from "@/server/exams";
import { LimitReachedError } from "@/server/entitlements";
import { xpSummary, streakSummary } from "@/server/progress";
import { makeUser, selectEvent } from "../support/factory";

const TZ = "America/Chicago";

describe("practice exams", () => {
  it("runs a Quick 10 with instant feedback, scoring and mistakes", async () => {
    const u = await makeUser();
    const id = await startAttempt({ userId: u.id, tz: TZ, clusterId: "deca-bac", mode: "quick10" });
    const { questions } = await loadAttempt(u.id, id);
    expect(questions).toHaveLength(10);
    // Answers are not exposed before answering.
    expect(JSON.stringify(questions)).not.toContain("answerIndex");
    const correctIds: string[] = [];
    for (const [i, q] of questions.entries()) {
      const [row] = await db.select().from(schema.questions).where(eq(schema.questions.id, q.id));
      const choice = i < 7 ? row.answerIndex : (row.answerIndex + 1) % 4;
      const r = await answerInstant(u.id, id, q.id, choice);
      expect(r.correct).toBe(i < 7);
      expect(r.explanation.length).toBeGreaterThan(5);
      if (i < 7) correctIds.push(q.id);
    }
    await submitAttempt(u.id, TZ, id);
    const review = await attemptReview(u.id, id);
    expect(review.attempt).toMatchObject({ correct: 7, total: 10 });
    const open = await db.select().from(schema.mistakes).where(and(eq(schema.mistakes.userId, u.id), isNull(schema.mistakes.clearedAt)));
    expect(open).toHaveLength(3);
    expect((await xpSummary(u.id, TZ)).total).toBe(10 * 1 + 7 * 5);
    expect((await streakSummary(u.id, TZ)).practicedToday).toBe(true);
  });

  it("does not allow answering the same question twice for extra XP", async () => {
    const u = await makeUser();
    const id = await startAttempt({ userId: u.id, tz: TZ, clusterId: "deca-bac", mode: "quick10" });
    const { questions } = await loadAttempt(u.id, id);
    const [row] = await db.select().from(schema.questions).where(eq(schema.questions.id, questions[0].id));
    await answerInstant(u.id, id, row.id, row.answerIndex);
    await answerInstant(u.id, id, row.id, row.answerIndex);
    expect((await xpSummary(u.id, TZ)).total).toBe(6);
  });

  it("clears a mistake after two correct answers in a row", async () => {
    const u = await makeUser();
    const a1 = await startAttempt({ userId: u.id, tz: TZ, clusterId: "hosa-mm", mode: "quick10" });
    const q = (await loadAttempt(u.id, a1)).questions[0];
    const [row] = await db.select().from(schema.questions).where(eq(schema.questions.id, q.id));
    await answerInstant(u.id, a1, q.id, (row.answerIndex + 1) % 4);
    await submitAttempt(u.id, TZ, a1);
    for (let i = 0; i < 2; i++) {
      const m = await startAttempt({ userId: u.id, tz: TZ, clusterId: "hosa-mm", mode: "mistakes" });
      await answerInstant(u.id, m, q.id, row.answerIndex);
      await submitAttempt(u.id, TZ, m);
    }
    const [mk] = await db.select().from(schema.mistakes).where(and(eq(schema.mistakes.userId, u.id), eq(schema.mistakes.questionId, q.id)));
    expect(mk.clearedAt).not.toBeNull();
    await expect(startAttempt({ userId: u.id, tz: TZ, clusterId: "hosa-mm", mode: "mistakes" })).rejects.toBeInstanceOf(ExamError);
  });

  it("full exam hides answers until submit, saves drafts, grades unanswered as wrong and enforces the free limit", async () => {
    const u = await makeUser();
    await selectEvent(u.id, "deca-pbm");
    const id = await startAttempt({ userId: u.id, tz: TZ, clusterId: "deca-bac", mode: "full" });
    const { questions, attempt } = await loadAttempt(u.id, id);
    expect(questions.length).toBe(91);
    expect(attempt.timeLimitSec).toBe(Math.round((60 * 60 * 91) / 100));
    await expect(answerInstant(u.id, id, questions[0].id, 0)).rejects.toBeInstanceOf(ExamError);
    // Resume returns the same attempt instead of charging again.
    expect(await startAttempt({ userId: u.id, tz: TZ, clusterId: "deca-bac", mode: "full" })).toBe(id);
    const draft: Record<string, number> = {};
    for (const q of questions.slice(0, 20)) {
      const [row] = await db.select().from(schema.questions).where(eq(schema.questions.id, q.id));
      draft[q.id] = row.answerIndex;
    }
    await saveDraft(u.id, id, draft, 300);
    await submitAttempt(u.id, TZ, id);
    const r = await attemptReview(u.id, id);
    expect(r.attempt).toMatchObject({ correct: 20, total: 91 });
    expect(r.topics.length).toBe(13);
    await startAttempt({ userId: u.id, tz: TZ, clusterId: "deca-bac", mode: "rehearsal" }).then((x) => submitAttempt(u.id, TZ, x));
    await expect(startAttempt({ userId: u.id, tz: TZ, clusterId: "deca-bac", mode: "full" })).rejects.toBeInstanceOf(LimitReachedError);
  });

  it("refuses another user's attempt", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const id = await startAttempt({ userId: a.id, tz: TZ, clusterId: "deca-bac", mode: "quick10" });
    await expect(loadAttempt(b.id, id)).rejects.toBeInstanceOf(ExamError);
    await expect(submitAttempt(b.id, TZ, id)).rejects.toBeInstanceOf(ExamError);
  });

  it("lesson check completes the lesson and awards XP", async () => {
    const u = await makeUser();
    const id = await startAttempt({ userId: u.id, tz: TZ, clusterId: "deca-bac", mode: "check", unitId: "deca-bac-u1" });
    const { questions } = await loadAttempt(u.id, id);
    expect(questions).toHaveLength(3);
    for (const q of questions) {
      const [row] = await db.select().from(schema.questions).where(eq(schema.questions.id, q.id));
      await answerInstant(u.id, id, q.id, row.answerIndex);
    }
    await submitAttempt(u.id, TZ, id);
    const [p] = await db.select().from(schema.lessonProgress).where(and(eq(schema.lessonProgress.userId, u.id), eq(schema.lessonProgress.unitId, "deca-bac-u1")));
    expect(p.lessonCompletedAt).not.toBeNull();
    expect(p.checkCorrect).toBe(3);
  });
});

describe("practice input checks", () => {
  it("treats malformed attempt ids as not found and refuses answers outside the choices", async () => {
    const u = await makeUser();
    await expect(loadAttempt(u.id, "not-an-attempt")).rejects.toBeInstanceOf(ExamError);
    await expect(attemptReview(u.id, "../../etc")).rejects.toBeInstanceOf(ExamError);
    const id = await startAttempt({ userId: u.id, tz: TZ, clusterId: "deca-bac", mode: "quick10" });
    const { questions } = await loadAttempt(u.id, id);
    for (const bad of [-1, 4, 1.5, Number.NaN]) await expect(answerInstant(u.id, id, questions[0].id, bad)).rejects.toBeInstanceOf(ExamError);
    const rows = await db.select().from(schema.attemptAnswers).where(eq(schema.attemptAnswers.attemptId, id));
    expect(rows).toEqual([]);
  });
});

describe("duel attempt review", () => {
  it("links the review back to that attempt's own duel", async () => {
    const u = await makeUser();
    const rows = await db
      .select({ id: schema.questions.id })
      .from(schema.questions)
      .where(and(eq(schema.questions.clusterId, "deca-bac"), eq(schema.questions.status, "published")))
      .limit(3);
    const qs = rows.map((r) => r.id);
    const attemptId = await startAttempt({ userId: u.id, tz: TZ, clusterId: "deca-bac", mode: "duel", questionIds: qs });
    const [duel] = await db
      .insert(schema.duels)
      .values({ clusterId: "deca-bac", creatorId: u.id, code: crypto.randomUUID().slice(0, 6).toUpperCase(), questionIds: qs, status: "active", expiresAt: new Date(Date.now() + 86_400_000) })
      .returning({ id: schema.duels.id });
    await db.insert(schema.duelEntries).values({ duelId: duel.id, userId: u.id, attemptId });
    for (const q of qs) await answerInstant(u.id, attemptId, q, 0);
    await submitAttempt(u.id, TZ, attemptId);
    expect((await attemptReview(u.id, attemptId)).duelId).toBe(duel.id);

    const quick = await startAttempt({ userId: u.id, tz: TZ, clusterId: "deca-bac", mode: "quick10" });
    for (const q of (await loadAttempt(u.id, quick)).questions) await answerInstant(u.id, quick, q.id, 0);
    await submitAttempt(u.id, TZ, quick);
    expect((await attemptReview(u.id, quick)).duelId).toBeNull();
  });
});

// ---- Adaptive Quick 10 -------------------------------------------------------------------

/** Small seeded PRNG (mulberry32) so property checks run over many reproducible draws. */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const NOW = new Date("2026-10-01T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);
const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);
function bank(units: number, perUnit: number) {
  const pool: AdaptiveInput["pool"] = [];
  for (let u = 0; u < units; u++) for (let i = 0; i < perUnit; i++) pool.push({ id: `u${u}-q${i}`, unitId: `u${u}` });
  return pool;
}
const answered = (ids: string[], correct: boolean, days: number) => ids.map((questionId) => ({ questionId, correct, answeredAt: daysAgo(days) }));
const unitCounts = (ids: string[]) => ids.reduce<Record<string, number>>((m, id) => ({ ...m, [id.split("-")[0]]: (m[id.split("-")[0]] ?? 0) + 1 }), {});
const pick = (input: Omit<AdaptiveInput, "now" | "rng" | "n"> & { n?: number }, seed: number) => selectAdaptiveQuestions({ n: 10, ...input, now: NOW, rng: seeded(seed) });

describe("adaptive Quick 10 selection", () => {
  it("weights toward weak and unseen units while still spreading across the bank", () => {
    const pool = bank(4, 10);
    // u0: all missed (weak) · u1, u2: all right (strong) · u3: never tried.
    const answers = [...answered(["u0-q0", "u0-q1", "u0-q2", "u0-q3", "u0-q4", "u0-q5"], false, 10), ...answered(["u1-q0", "u1-q1", "u1-q2", "u1-q3", "u1-q4", "u1-q5"], true, 10), ...answered(["u2-q0", "u2-q1", "u2-q2", "u2-q3", "u2-q4", "u2-q5"], true, 10)];
    for (const seed of SEEDS) {
      const ids = pick({ pool, answers, openMistakes: [] }, seed);
      const c = unitCounts(ids);
      expect(ids).toHaveLength(10);
      expect(c.u0).toBeGreaterThanOrEqual(3);
      expect(c.u3).toBeGreaterThanOrEqual(3);
      expect(c.u1 ?? 0).toBeLessThanOrEqual(2);
      expect(c.u2 ?? 0).toBeLessThanOrEqual(2);
      expect((c.u1 ?? 0) + (c.u2 ?? 0)).toBeGreaterThanOrEqual(1);
      // Inside a unit, questions never seen come before ones already answered.
      const u0 = ids.filter((id) => id.startsWith("u0-"));
      expect(u0.filter((id) => Number(id.split("q")[1]) < 6).length).toBe(Math.max(0, u0.length - 4));
    }
  });

  it("gives a brand-new student one question per unit before any unit repeats", () => {
    for (const seed of SEEDS) {
      const wide = pick({ pool: bank(13, 7), answers: [], openMistakes: [] }, seed);
      expect(Object.keys(unitCounts(wide))).toHaveLength(10);
      const c = Object.values(unitCounts(pick({ pool: bank(4, 3), answers: [], openMistakes: [] }, seed)));
      expect(c.reduce((x, y) => x + y, 0)).toBe(10);
      expect(Math.max(...c) - Math.min(...c)).toBeLessThanOrEqual(1);
    }
  });

  it("includes about two open mistakes, preferring ones not answered in the last few days", () => {
    const pool = bank(5, 10);
    const answers = [...answered(["u1-q0", "u2-q0"], false, 6), ...answered(["u3-q0"], false, 1)];
    for (const seed of SEEDS) {
      const ids = pick({ pool, answers, openMistakes: ["u3-q0", "u1-q0", "u2-q0", "retired-question"] }, seed);
      expect(ids.filter((id) => ["u1-q0", "u2-q0", "u3-q0"].includes(id)).sort()).toEqual(["u1-q0", "u2-q0"]);
      expect(ids).not.toContain("retired-question");
    }
    // A single open mistake is still included, even when it was just missed.
    expect(pick({ pool, answers, openMistakes: ["u3-q0"] }, 1)).toContain("u3-q0");
  });

  it("skips questions answered in the last 3 days while fresher ones remain", () => {
    const pool = bank(3, 6);
    const recent = ["u0-q0", "u0-q1", "u1-q0", "u1-q1", "u2-q0", "u2-q1"];
    const answers = [...answered(recent, true, 1), ...answered(["u0-q2", "u1-q2"], true, 5)];
    for (const seed of SEEDS) {
      const ids = pick({ pool, answers, openMistakes: [] }, seed);
      expect(ids).toHaveLength(10);
      expect(ids.filter((id) => recent.includes(id))).toEqual([]);
    }
    // When the bank runs out of fresh questions, recent ones fill the set rather than coming up short.
    const tiny = bank(2, 4);
    const tinyRecent = ["u0-q0", "u0-q1", "u1-q0", "u1-q1"];
    const ids = pick({ pool: tiny, answers: answered(tinyRecent, true, 1), openMistakes: [] }, 7);
    expect([...ids].sort()).toEqual(tiny.map((q) => q.id).sort());
  });

  it("never repeats a question and copes with tiny, empty and unit-less banks", () => {
    const pool = [...bank(2, 2), { id: "loose-1", unitId: null }, { id: "loose-1", unitId: null }];
    for (const seed of SEEDS) {
      const ids = pick({ pool, answers: answered(["u0-q0"], false, 9), openMistakes: ["u0-q0", "u0-q0"] }, seed);
      expect(new Set(ids).size).toBe(ids.length);
      expect([...ids].sort()).toEqual(["loose-1", "u0-q0", "u0-q1", "u1-q0", "u1-q1"]);
      const big = pick({ pool: bank(6, 12), answers: answered(["u1-q1", "u1-q2"], false, 2), openMistakes: ["u1-q1", "u1-q2"] }, seed);
      expect(new Set(big).size).toBe(10);
    }
    expect(pick({ pool: [], answers: [], openMistakes: [] }, 1)).toEqual([]);
    expect(pick({ pool: bank(1, 3), answers: [], openMistakes: [] }, 1)).toHaveLength(3);
  });

  it("Quick 10 brings back open mistakes and skips what the student just answered", async () => {
    const u = await makeUser();
    const first = await startAttempt({ userId: u.id, tz: TZ, clusterId: "deca-bac", mode: "quick10" });
    const { questions } = await loadAttempt(u.id, first);
    const right: string[] = [];
    const missed: string[] = [];
    for (const [i, q] of questions.entries()) {
      const [row] = await db.select().from(schema.questions).where(eq(schema.questions.id, q.id));
      await answerInstant(u.id, first, q.id, i < 7 ? row.answerIndex : (row.answerIndex + 1) % row.choices.length);
      (i < 7 ? right : missed).push(q.id);
    }
    await submitAttempt(u.id, TZ, first);
    const second = await startAttempt({ userId: u.id, tz: TZ, clusterId: "deca-bac", mode: "quick10" });
    expect(second).not.toBe(first);
    const ids = (await loadAttempt(u.id, second)).attempt.questionIds;
    expect(new Set(ids).size).toBe(10);
    expect(ids.filter((id) => missed.includes(id))).toHaveLength(2);
    expect(ids.filter((id) => right.includes(id))).toEqual([]);
  });
});
