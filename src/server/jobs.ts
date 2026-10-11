import "server-only";
import { and, eq, gte, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { addDays, daysUntil, todayIn, formatRange } from "@/lib/dates";
import { randomToken, sha256 } from "@/lib/crypto";
import { env } from "@/lib/env";
import { errorDetail } from "@/lib/errors";
import { deleteAccount } from "./account";
import { sendEmail } from "./email";
import { notifyUsers } from "./notify";
import { resolveTarget } from "./dashboard";
import { releaseStaleReservations } from "./entitlements";
import { streakSummary, xpSummary } from "./progress";

const localHour = (tz: string, now = new Date()) => Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(now));
const localWeekday = (tz: string, now = new Date()) => new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(now);

async function activeStudents() {
  return db
    .select({ userId: schema.users.id, email: schema.users.email, tz: schema.profiles.timezone, first: schema.profiles.firstName, prefs: schema.notificationPrefs })
    .from(schema.users)
    .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
    .leftJoin(schema.notificationPrefs, eq(schema.notificationPrefs.userId, schema.users.id))
    .where(isNotNull(schema.profiles.onboardingCompletedAt));
}

/** Hourly: at 6pm local, remind students with a streak who haven't practiced today. Never more than once a day. */
export async function streakReminders(now = new Date()) {
  let sent = 0;
  for (const u of await activeStudents()) {
    if (u.prefs && !u.prefs.streakReminder) continue;
    if (localHour(u.tz, now) !== 18) continue;
    const s = await streakSummary(u.userId, u.tz, now);
    if (s.practicedToday || s.current === 0) continue;
    await notifyUsers([u.userId], "streakReminder", {
      kind: "streak",
      title: `Keep your ${s.current}-day streak going`,
      body: "A quick Quick 10 counts.",
      href: "/study",
      dedupeKey: `streak:${todayIn(u.tz, now)}`,
    });
    sent++;
  }
  return { sent };
}

/** Daily: a week before and the day before each student's competition. */
export async function competitionReminders(now = new Date()) {
  let sent = 0;
  const sels = await db
    .select({ sel: schema.eventSelections, event: schema.events, email: schema.users.email, tz: schema.profiles.timezone, prefs: schema.notificationPrefs })
    .from(schema.eventSelections)
    .innerJoin(schema.events, eq(schema.events.id, schema.eventSelections.eventId))
    .innerJoin(schema.users, eq(schema.users.id, schema.eventSelections.userId))
    .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.eventSelections.userId))
    .leftJoin(schema.notificationPrefs, eq(schema.notificationPrefs.userId, schema.eventSelections.userId))
    .where(eq(schema.eventSelections.active, true));
  for (const r of sels) {
    const t = await resolveTarget(r.sel.userId, r.sel, r.tz, now);
    if (!t) continue;
    const d = daysUntil(t.startsOn, r.tz, now);
    if (d !== 7 && d !== 1) continue;
    const title = d === 1 ? `${t.shortName} is tomorrow` : `One week until ${t.shortName}`;
    if (!r.prefs || r.prefs.competitionCountdown)
      await notifyUsers([r.sel.userId], "competitionCountdown", { kind: "countdown", title, body: `${r.event.code} · ${formatRange(t.startsOn, t.endsOn)}`, href: "/study", dedupeKey: `cd:${r.sel.id}:${d}:${t.startsOn}` });
    if (!r.prefs || r.prefs.competitionReminderEmails) {
      await sendEmail({
        to: r.email,
        template: "competition_reminder",
        subject: title,
        text: `${title}: ${t.name}, ${formatRange(t.startsOn, t.endsOn)}${t.location ? `, ${t.location}` : ""}.\n\n${d === 1 ? "Get a good night's sleep and review your notes. You've got this." : "This is game week: try a test-day rehearsal and a judge run."}\n\n${env.appUrl}/study\n\nTurn off competition emails in Profile → Privacy.`,
      }).catch(() => undefined);
    }
    sent++;
  }
  return { sent };
}

/** Hourly: Sunday 6pm local weekly recap email. */
export async function weeklyRecaps(now = new Date()) {
  let sent = 0;
  for (const u of await activeStudents()) {
    if (u.prefs && !u.prefs.weeklyRecapEmail) continue;
    if (localWeekday(u.tz, now) !== "Sun" || localHour(u.tz, now) !== 18) continue;
    const since = new Date(`${addDays(todayIn(u.tz, now), -6)}T00:00:00Z`);
    const [{ n, c }] = await db
      .select({ n: sql<number>`count(*)::int`, c: sql<number>`count(*) filter (where ${schema.attemptAnswers.correct})::int` })
      .from(schema.attemptAnswers)
      .where(and(eq(schema.attemptAnswers.userId, u.userId), gte(schema.attemptAnswers.answeredAt, since)));
    const xp = await xpSummary(u.userId, u.tz, now);
    if (!n && !xp.week) continue; // nothing to recap; don't nag
    const dedupe = `recap:${todayIn(u.tz, now)}`;
    const [already] = await db.select().from(schema.notifications).where(and(eq(schema.notifications.userId, u.userId), eq(schema.notifications.dedupeKey, dedupe)));
    if (already) continue;
    await db.insert(schema.notifications).values({ userId: u.userId, kind: "recap", title: "Your weekly recap", body: `+${xp.week} XP · ${n} questions`, href: "/study", dedupeKey: dedupe }).onConflictDoNothing();
    await sendEmail({
      to: u.email,
      template: "weekly_recap",
      subject: `Your PrepX week: +${xp.week} XP`,
      text: `Hi ${u.first},\n\nThis week: +${xp.week} XP, ${n} practice questions${n ? `, ${Math.round((c / n) * 100)}% accuracy` : ""}. Level: ${xp.level.name}.\n\nKeep it steady: ${env.appUrl}/study\n\nTurn off weekly recaps in Profile → Notifications.`,
    }).catch(() => undefined);
    sent++;
  }
  return { sent };
}

/** Daily: on the 1st, email confirmed parents a summary. Each email carries a fresh stop link. */
export async function parentMonthly(now = new Date()) {
  if (now.getUTCDate() !== 1) return { sent: 0 };
  let sent = 0;
  const links = await db
    .select({ link: schema.familyLinks, first: schema.profiles.firstName, tz: schema.profiles.timezone })
    .from(schema.familyLinks)
    .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.familyLinks.studentId))
    .where(eq(schema.familyLinks.status, "confirmed"));
  for (const { link, first, tz } of links) {
    if (link.lastReportAt && now.getTime() - link.lastReportAt.getTime() < 20 * 86400_000) continue;
    const since = new Date(now.getTime() - 30 * 86400_000);
    const [{ days }] = await db.select({ days: sql<number>`count(*)::int` }).from(schema.activityDays).where(and(eq(schema.activityDays.userId, link.studentId), gte(schema.activityDays.day, since.toISOString().slice(0, 10))));
    const [{ n, c }] = await db
      .select({ n: sql<number>`count(*)::int`, c: sql<number>`count(*) filter (where ${schema.attemptAnswers.correct})::int` })
      .from(schema.attemptAnswers)
      .where(and(eq(schema.attemptAnswers.userId, link.studentId), gte(schema.attemptAnswers.answeredAt, since)));
    const scores = await db
      .select({ s: schema.aiFeedback.score })
      .from(schema.aiFeedback)
      .where(and(eq(schema.aiFeedback.userId, link.studentId), gte(schema.aiFeedback.createdAt, since)));
    const streak = await streakSummary(link.studentId, tz, now);
    const token = randomToken();
    await db.update(schema.familyLinks).set({ tokenHash: sha256(token), lastReportAt: now }).where(eq(schema.familyLinks.id, link.id));
    await sendEmail({
      to: link.parentEmail,
      template: "parent_monthly",
      subject: `${first}'s PrepX month`,
      text: `Here's ${first}'s last 30 days on PrepX:\n\n• Days practiced: ${days}\n• Current streak: ${streak.current} days\n• Practice-test accuracy: ${n ? `${Math.round((c / n) * 100)}% on ${n} questions` : "no tests this month"}\n• Practice judge scores: ${scores.length ? scores.map((x) => x.s).join(", ") : "none this month"} (simulated practice scores, not official)\n\nStop these emails: ${env.appUrl}/family/stop?token=${token}\n\nPrepX · ${env.supportEmail}`,
    }).catch(() => undefined);
    sent++;
  }
  return { sent };
}

/** Daily retention cleanup. Matches the retention periods in the privacy policy. */
export async function cleanup(now = new Date()) {
  const ago = (days: number) => new Date(now.getTime() - days * 86400_000);
  const ai = await db.delete(schema.aiSessions).where(lt(schema.aiSessions.updatedAt, ago(180))).returning({ id: schema.aiSessions.id });
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, now));
  await db.delete(schema.emailCodes).where(lt(schema.emailCodes.expiresAt, ago(1)));
  await db.delete(schema.rateLimits).where(lt(schema.rateLimits.windowStart, ago(2)));
  await db.delete(schema.errorLog).where(lt(schema.errorLog.createdAt, ago(30)));
  await db.delete(schema.emailLog).where(lt(schema.emailLog.createdAt, ago(30)));
  await db.delete(schema.notifications).where(lt(schema.notifications.createdAt, ago(120)));
  await releaseStaleReservations();
  // Sign-ups never finished within a week (no profile counts as unfinished) are deleted the same way as a user's own request.
  const abandoned = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
    .where(and(isNull(schema.profiles.onboardingCompletedAt), lt(schema.users.createdAt, ago(7))));
  let abandonedSignUpsDeleted = 0;
  for (const { id } of abandoned) {
    try {
      await deleteAccount(id, "abandoned_sign_up");
      abandonedSignUpsDeleted++;
    } catch (e) {
      console.error("abandoned sign-up deletion failed", errorDetail(e));
    }
  }
  return { aiSessionsDeleted: ai.length, abandonedSignUpsDeleted };
}

export const JOBS = { "streak-reminders": streakReminders, "competition-reminders": competitionReminders, "weekly-recaps": weeklyRecaps, "parent-monthly": parentMonthly, cleanup } as const;
