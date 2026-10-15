import "server-only";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CheckQuestion } from "@/components/app/course/types";

/** The user's latest lesson-check attempt for a unit (only unsubmitted ones when `openOnly`). */
export async function latestCheckAttempt(userId: string, unitId: string, openOnly: boolean) {
  const [a] = await db
    .select({ id: schema.examAttempts.id, questionIds: schema.examAttempts.questionIds })
    .from(schema.examAttempts)
    .where(
      and(
        eq(schema.examAttempts.userId, userId),
        eq(schema.examAttempts.mode, "check"),
        eq(schema.examAttempts.unitId, unitId),
        openOnly ? isNull(schema.examAttempts.submittedAt) : undefined,
      ),
    )
    .orderBy(desc(schema.examAttempts.startedAt))
    .limit(1);
  return a ?? null;
}

/** The questions a new lesson check would use (same choice and order as `startAttempt` in "check" mode). */
export async function defaultCheckIds(unitId: string) {
  const rows = await db
    .select({ id: schema.questions.id })
    .from(schema.questions)
    .where(and(eq(schema.questions.unitId, unitId), eq(schema.questions.status, "published")))
    .orderBy(schema.questions.createdAt, schema.questions.id)
    .limit(3);
  return rows.map((r) => r.id);
}

/**
 * The lesson's check questions: an unfinished check's questions (with answers so far), or after
 * the lesson is complete, the last check's questions and answers. Answers are only included for
 * questions already answered.
 */
export async function checkSet(userId: string, unitId: string, complete: boolean) {
  const attempt = await latestCheckAttempt(userId, unitId, !complete);
  const ids = attempt?.questionIds ?? (await defaultCheckIds(unitId));
  return { attemptId: attempt?.id ?? null, ids };
}

export async function checkQuestions(userId: string, unitId: string, complete: boolean): Promise<CheckQuestion[]> {
  const { attemptId, ids } = await checkSet(userId, unitId, complete);
  if (!ids.length) return [];
  const qs = await db.select().from(schema.questions).where(inArray(schema.questions.id, ids));
  const answers = attemptId ? await db.select().from(schema.attemptAnswers).where(eq(schema.attemptAnswers.attemptId, attemptId)) : [];
  const byId = new Map(qs.map((q) => [q.id, q]));
  const ansById = new Map(answers.map((a) => [a.questionId, a]));
  return ids.flatMap((id) => {
    const q = byId.get(id);
    if (!q) return [];
    const a = ansById.get(id);
    return [{ id, stem: q.stem, choices: q.choices, answered: a ? { chosen: a.chosenIndex, correct: a.correct, answerIndex: q.answerIndex, explanation: q.explanation } : null }];
  });
}
