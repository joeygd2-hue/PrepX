"use server";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { XP } from "@/lib/levels";
import { userOrThrow } from "@/server/auth/session";
import { answerInstant, ExamError, startAttempt, submitAttempt } from "@/server/exams";
import { awardXp, recordActivity, syncAchievements } from "@/server/progress";
import { autoCompleteTask } from "@/server/dashboard";
import { checkSet, defaultCheckIds, latestCheckAttempt } from "./data";

const unitIdSchema = z.string().trim().min(1).max(200);
const answerSchema = z.object({ unitId: unitIdSchema, questionId: z.guid(), choice: z.number().int().min(0).max(9) });

export type CheckAnswerResult = { ok: true; correct: boolean; answerIndex: number; explanation: string } | { ok: false; error: string };
export type FinishLessonResult = { ok: true; correct: number; total: number; xp: number } | { ok: false; error: string };

async function lessonState(userId: string, unitId: string) {
  const [unit] = await db.select({ id: schema.units.id, clusterId: schema.units.clusterId }).from(schema.units).where(eq(schema.units.id, unitId));
  const [progress] = await db
    .select()
    .from(schema.lessonProgress)
    .where(and(eq(schema.lessonProgress.userId, userId), eq(schema.lessonProgress.unitId, unitId)));
  return { unit: unit ?? null, progress: progress ?? null };
}

/**
 * Answers one of the lesson's check questions inline. Before the lesson is complete the answer
 * is recorded on the unit's lesson-check attempt (created on the first answer), exactly like the
 * check in practice mode. Afterwards it is graded for review only, so re-reading never changes
 * the saved score, mastery or XP.
 */
export async function answerCheckAction(unitId: string, questionId: string, choice: number): Promise<CheckAnswerResult> {
  const user = await userOrThrow();
  const parsed = answerSchema.safeParse({ unitId, questionId, choice });
  if (!parsed.success) return { ok: false, error: "That answer couldn't be read. Try again." };
  const { unit, progress } = await lessonState(user.id, parsed.data.unitId);
  if (!unit) return { ok: false, error: "Lesson not found." };
  const complete = Boolean(progress?.lessonCompletedAt);
  const { ids } = await checkSet(user.id, unit.id, complete);
  if (!ids.includes(parsed.data.questionId)) return { ok: false, error: "That question isn't part of this lesson's check." };
  const [q] = await db.select().from(schema.questions).where(and(eq(schema.questions.id, parsed.data.questionId), eq(schema.questions.unitId, unit.id)));
  if (!q || parsed.data.choice >= q.choices.length) return { ok: false, error: "That question isn't available." };
  if (complete) return { ok: true, correct: parsed.data.choice === q.answerIndex, answerIndex: q.answerIndex, explanation: q.explanation };
  try {
    const open = await latestCheckAttempt(user.id, unit.id, true);
    const attemptId = open?.id ?? (await startAttempt({ userId: user.id, tz: user.profile!.timezone, clusterId: unit.clusterId, mode: "check", unitId: unit.id }));
    return { ok: true, ...(await answerInstant(user.id, attemptId, q.id, parsed.data.choice)) };
  } catch (e) {
    if (e instanceof ExamError) return { ok: false, error: e.message };
    throw e;
  }
}

/**
 * Marks the lesson complete from the reader's finish page. Submits the unit's lesson-check
 * attempt (the existing completion path: lesson progress, check score, XP, plan task, streak and
 * achievements). Idempotent: a finished lesson just reports its saved score.
 */
export async function finishLessonAction(unitId: string): Promise<FinishLessonResult> {
  const user = await userOrThrow();
  const parsed = unitIdSchema.safeParse(unitId);
  if (!parsed.success) return { ok: false, error: "Lesson not found." };
  const tz = user.profile!.timezone;
  const before = await lessonState(user.id, parsed.data);
  if (!before.unit) return { ok: false, error: "Lesson not found." };
  const unit = before.unit;
  let xp = 0;
  if (!before.progress?.lessonCompletedAt) {
    try {
      const open = await latestCheckAttempt(user.id, unit.id, true);
      const hasQuestions = open ? open.questionIds.length > 0 : (await defaultCheckIds(unit.id)).length > 0;
      if (hasQuestions) {
        const attemptId = open?.id ?? (await startAttempt({ userId: user.id, tz, clusterId: unit.clusterId, mode: "check", unitId: unit.id }));
        await submitAttempt(user.id, tz, attemptId);
      } else {
        // A unit without check questions: finishing the reading completes the lesson.
        await db
          .insert(schema.lessonProgress)
          .values({ userId: user.id, unitId: unit.id, lessonCompletedAt: new Date(), checkCorrect: 0 })
          .onConflictDoUpdate({ target: [schema.lessonProgress.userId, schema.lessonProgress.unitId], set: { lessonCompletedAt: sql`coalesce(${schema.lessonProgress.lessonCompletedAt}, now())` } });
        await awardXp(user.id, XP.lessonComplete, "lesson", unit.id);
      }
      // Finishing a lesson is study activity and completes today's lesson task even when every
      // check was skipped (submitAttempt only counts attempts with answers). All idempotent.
      await recordActivity(user.id, tz);
      await autoCompleteTask(user.id, tz, ["lesson"]);
      await syncAchievements(user.id, tz);
      xp = XP.lessonComplete;
    } catch (e) {
      if (e instanceof ExamError) return { ok: false, error: e.message };
      throw e;
    }
    // The course overview, Study page and plan show lesson progress; don't let cached copies go stale.
    revalidatePath("/study/learn");
  }
  const after = await lessonState(user.id, unit.id);
  const { ids } = await checkSet(user.id, unit.id, true);
  return { ok: true, correct: after.progress?.checkCorrect ?? 0, total: ids.length, xp };
}
