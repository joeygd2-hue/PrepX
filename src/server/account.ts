import "server-only";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db, schema } from "@/db";
import { cancelStripeSubscriptions } from "@/server/billing";

/**
 * Permanently deletes a user. Personal data is removed through ON DELETE CASCADE, plus what
 * isn't linked by user id: their feedback, and the email delivery log, sign-in codes and
 * rate-limit counters for their address (and the delivery log for their linked parent).
 * Retained (documented in the privacy policy): payment-provider event ids with no
 * personal data, and an audit entry recording that a deletion happened.
 * Chapters the user advises are handed to another officer/member, or deleted if empty.
 * Open Stripe subscriptions are cancelled first; if that fails it throws
 * SubscriptionCancelError and nothing is deleted.
 */
export async function deleteAccount(userId: string, reason: string) {
  const [user] = await db.select({ email: schema.users.email }).from(schema.users).where(eq(schema.users.id, userId));
  if (!user) return;
  await cancelStripeSubscriptions(userId);
  const email = user.email.trim().toLowerCase();
  const parents = await db.select({ email: schema.familyLinks.parentEmail }).from(schema.familyLinks).where(eq(schema.familyLinks.studentId, userId));
  const recipients = [...new Set([email, ...parents.map((p) => p.email.trim().toLowerCase())])];
  await db.transaction(async (tx) => {
    const advised = await tx
      .select({ chapterId: schema.chapterMembers.chapterId })
      .from(schema.chapterMembers)
      .where(and(eq(schema.chapterMembers.userId, userId), eq(schema.chapterMembers.role, "advisor")));
    for (const { chapterId } of advised) {
      const others = await tx
        .select()
        .from(schema.chapterMembers)
        .where(and(eq(schema.chapterMembers.chapterId, chapterId), ne(schema.chapterMembers.userId, userId)))
        .orderBy(sql`case ${schema.chapterMembers.role} when 'advisor' then 0 when 'officer' then 1 else 2 end`, asc(schema.chapterMembers.joinedAt));
      if (!others.length) {
        await tx.delete(schema.chapters).where(eq(schema.chapters.id, chapterId));
      } else if (!others.some((o) => o.role === "advisor")) {
        await tx
          .update(schema.chapterMembers)
          .set({ role: "advisor" })
          .where(and(eq(schema.chapterMembers.chapterId, chapterId), eq(schema.chapterMembers.userId, others[0].userId)));
      }
    }
    await tx.delete(schema.emailLog).where(inArray(sql`lower(${schema.emailLog.to})`, recipients));
    await tx.delete(schema.emailCodes).where(sql`lower(${schema.emailCodes.email}) = ${email}`);
    // Keys are colon-separated (code:email:<email>); match the address as a whole segment.
    await tx.delete(schema.rateLimits).where(sql`strpos(${schema.rateLimits.key} || ':', ${`:${email}:`}) > 0`);
    await tx.delete(schema.feedback).where(eq(schema.feedback.userId, userId));
    await tx.insert(schema.auditLog).values({ action: "account_deleted", meta: { reason } });
    await tx.delete(schema.users).where(eq(schema.users.id, userId));
  });
}

/** Everything we hold about a user, as JSON (Profile → Download my data). */
export async function exportAccount(userId: string) {
  const q = <T>(p: Promise<T>) => p;
  const [user] = await db
    .select({ email: schema.users.email, emailVerifiedAt: schema.users.emailVerifiedAt, googleSub: schema.users.googleSub, createdAt: schema.users.createdAt, lastSeenAt: schema.users.lastSeenAt, role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.id, userId));
  // Buddies are shown by display name, as in the app; `mine` is the user's side of the pair.
  const buddies = (mine: AnyPgColumn, theirs: AnyPgColumn) =>
    db
      .select({ buddy: schema.profiles.displayName, status: schema.buddies.status, createdAt: schema.buddies.createdAt, lastNudgeAt: schema.buddies.lastNudgeAt })
      .from(schema.buddies)
      .leftJoin(schema.profiles, eq(schema.profiles.userId, theirs))
      .where(eq(mine, userId));
  return {
    exportedAt: new Date().toISOString(),
    account: user,
    sessions: await db
      .select({ createdAt: schema.sessions.createdAt, expiresAt: schema.sessions.expiresAt, userAgent: schema.sessions.userAgent })
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, userId)),
    profile: (await q(db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId))))[0],
    organizationPreferences: await db.select().from(schema.orgPreferences).where(eq(schema.orgPreferences.userId, userId)),
    notificationPreferences: (await db.select().from(schema.notificationPrefs).where(eq(schema.notificationPrefs.userId, userId)))[0],
    pushSubscriptions: await db.select({ endpoint: schema.pushSubscriptions.endpoint, createdAt: schema.pushSubscriptions.createdAt }).from(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.userId, userId)),
    eventSelections: await db.select().from(schema.eventSelections).where(eq(schema.eventSelections.userId, userId)),
    studyPlanTasks: await db.select().from(schema.planTasks).where(eq(schema.planTasks.userId, userId)),
    seasonGoals: await db.select().from(schema.seasonGoals).where(eq(schema.seasonGoals.userId, userId)),
    examAttempts: await db.select().from(schema.examAttempts).where(eq(schema.examAttempts.userId, userId)),
    answers: await db.select().from(schema.attemptAnswers).where(eq(schema.attemptAnswers.userId, userId)),
    mistakeNotebook: await db.select().from(schema.mistakes).where(eq(schema.mistakes.userId, userId)),
    lessonProgress: await db.select().from(schema.lessonProgress).where(eq(schema.lessonProgress.userId, userId)),
    flashcardReviews: await db.select().from(schema.flashcardReviews).where(eq(schema.flashcardReviews.userId, userId)),
    sprintBests: await db.select().from(schema.sprintBests).where(eq(schema.sprintBests.userId, userId)),
    questionBookmarks: await db.select().from(schema.questionBookmarks).where(eq(schema.questionBookmarks.userId, userId)),
    duelsCreated: await db.select().from(schema.duels).where(eq(schema.duels.creatorId, userId)),
    duelsJoined: await db.select().from(schema.duels).where(eq(schema.duels.opponentId, userId)),
    duelEntries: await db.select().from(schema.duelEntries).where(eq(schema.duelEntries.userId, userId)),
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
    buddies: { requestsSent: await buddies(schema.buddies.requesterId, schema.buddies.addresseeId), requestsReceived: await buddies(schema.buddies.addresseeId, schema.buddies.requesterId) },
    chapterMemberships: await db.select().from(schema.chapterMembers).where(eq(schema.chapterMembers.userId, userId)),
    chapterAnnouncementsPosted: await db
      .select({ chapterId: schema.chapterAnnouncements.chapterId, title: schema.chapterAnnouncements.title, body: schema.chapterAnnouncements.body, createdAt: schema.chapterAnnouncements.createdAt })
      .from(schema.chapterAnnouncements)
      .where(eq(schema.chapterAnnouncements.authorId, userId)),
    checkins: await db.select().from(schema.checkinRecords).where(eq(schema.checkinRecords.userId, userId)),
    quizAnswers: await db.select().from(schema.quizAnswers).where(eq(schema.quizAnswers.userId, userId)),
    familyLink: await db.select({ parentEmail: schema.familyLinks.parentEmail, status: schema.familyLinks.status, confirmedAt: schema.familyLinks.confirmedAt }).from(schema.familyLinks).where(eq(schema.familyLinks.studentId, userId)),
    notifications: await db.select().from(schema.notifications).where(eq(schema.notifications.userId, userId)),
    announcementDismissals: await db.select().from(schema.announcementDismissals).where(eq(schema.announcementDismissals.userId, userId)),
    feedback: await db.select().from(schema.feedback).where(eq(schema.feedback.userId, userId)),
    subscription: await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId)),
    paymentEvents: await db.select({ id: schema.billingEvents.id, type: schema.billingEvents.type, receivedAt: schema.billingEvents.receivedAt }).from(schema.billingEvents).where(eq(schema.billingEvents.userId, userId)),
    usage: await db.select().from(schema.usageRecords).where(eq(schema.usageRecords.userId, userId)),
  };
}
