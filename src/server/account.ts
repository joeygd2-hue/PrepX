import "server-only";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { cancelStripeSubscription } from "@/server/billing";

/**
 * Permanently deletes a user. Personal data is removed through ON DELETE CASCADE.
 * Retained (documented in the privacy policy): payment-provider event ids with no
 * personal data, and an audit entry recording that a deletion happened.
 * Chapters the user advises are handed to another officer/member, or deleted if empty.
 */
export async function deleteAccount(userId: string, reason: string) {
  const advised = await db
    .select({ chapterId: schema.chapterMembers.chapterId })
    .from(schema.chapterMembers)
    .where(and(eq(schema.chapterMembers.userId, userId), eq(schema.chapterMembers.role, "advisor")));
  for (const { chapterId } of advised) {
    const others = await db
      .select()
      .from(schema.chapterMembers)
      .where(and(eq(schema.chapterMembers.chapterId, chapterId), ne(schema.chapterMembers.userId, userId)))
      .orderBy(sql`case ${schema.chapterMembers.role} when 'advisor' then 0 when 'officer' then 1 else 2 end`, asc(schema.chapterMembers.joinedAt));
    if (!others.length) {
      await db.delete(schema.chapters).where(eq(schema.chapters.id, chapterId));
    } else if (!others.some((o) => o.role === "advisor")) {
      await db
        .update(schema.chapterMembers)
        .set({ role: "advisor" })
        .where(and(eq(schema.chapterMembers.chapterId, chapterId), eq(schema.chapterMembers.userId, others[0].userId)));
    }
  }
  try {
    await cancelStripeSubscription(userId);
  } catch (e) {
    console.error("subscription cancel during deletion failed", (e as Error).message);
  }
  await db.insert(schema.auditLog).values({ action: "account_deleted", meta: { reason } });
  await db.delete(schema.users).where(eq(schema.users.id, userId));
}

/** Everything we hold about a user, as JSON (Profile → Download my data). */
export async function exportAccount(userId: string) {
  const q = <T>(p: Promise<T>) => p;
  const [user] = await db.select({ email: schema.users.email, createdAt: schema.users.createdAt, role: schema.users.role }).from(schema.users).where(eq(schema.users.id, userId));
  return {
    exportedAt: new Date().toISOString(),
    account: user,
    profile: (await q(db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId))))[0],
    organizationPreferences: await db.select().from(schema.orgPreferences).where(eq(schema.orgPreferences.userId, userId)),
    notificationPreferences: (await db.select().from(schema.notificationPrefs).where(eq(schema.notificationPrefs.userId, userId)))[0],
    eventSelections: await db.select().from(schema.eventSelections).where(eq(schema.eventSelections.userId, userId)),
    studyPlanTasks: await db.select().from(schema.planTasks).where(eq(schema.planTasks.userId, userId)),
    seasonGoals: await db.select().from(schema.seasonGoals).where(eq(schema.seasonGoals.userId, userId)),
    examAttempts: await db.select().from(schema.examAttempts).where(eq(schema.examAttempts.userId, userId)),
    answers: await db.select().from(schema.attemptAnswers).where(eq(schema.attemptAnswers.userId, userId)),
    mistakeNotebook: await db.select().from(schema.mistakes).where(eq(schema.mistakes.userId, userId)),
    lessonProgress: await db.select().from(schema.lessonProgress).where(eq(schema.lessonProgress.userId, userId)),
    flashcardReviews: await db.select().from(schema.flashcardReviews).where(eq(schema.flashcardReviews.userId, userId)),
    aiSessions: await db.select().from(schema.aiSessions).where(eq(schema.aiSessions.userId, userId)),
    aiMessages: await db
      .select({ sessionId: schema.aiMessages.sessionId, role: schema.aiMessages.role, content: schema.aiMessages.content, createdAt: schema.aiMessages.createdAt })
      .from(schema.aiMessages)
      .innerJoin(schema.aiSessions, eq(schema.aiSessions.id, schema.aiMessages.sessionId))
      .where(eq(schema.aiSessions.userId, userId)),
    aiFeedback: await db.select().from(schema.aiFeedback).where(eq(schema.aiFeedback.userId, userId)),
    xp: await db.select().from(schema.xpEvents).where(eq(schema.xpEvents.userId, userId)),
    activityDays: await db.select().from(schema.activityDays).where(eq(schema.activityDays.userId, userId)),
    achievements: await db.select().from(schema.userAchievements).where(eq(schema.userAchievements.userId, userId)),
    chapterMemberships: await db.select().from(schema.chapterMembers).where(eq(schema.chapterMembers.userId, userId)),
    checkins: await db.select().from(schema.checkinRecords).where(eq(schema.checkinRecords.userId, userId)),
    familyLink: await db.select({ parentEmail: schema.familyLinks.parentEmail, status: schema.familyLinks.status, confirmedAt: schema.familyLinks.confirmedAt }).from(schema.familyLinks).where(eq(schema.familyLinks.studentId, userId)),
    notifications: await db.select().from(schema.notifications).where(eq(schema.notifications.userId, userId)),
    subscription: await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId)),
    usage: await db.select().from(schema.usageRecords).where(eq(schema.usageRecords.userId, userId)),
  };
}
