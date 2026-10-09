import { describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { answerInstant, attemptReview, ExamError, loadAttempt, saveDraft, startAttempt, submitAttempt } from "@/server/exams";
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
