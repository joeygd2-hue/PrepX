"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { getCurrentUser, userOrThrow, destroySession } from "@/server/auth/session";
import { xpSummary } from "@/server/progress";
import { deleteAccount } from "@/server/account";
import { SubscriptionCancelError } from "@/server/billing";
import { sendEmail } from "@/server/email";
import { rateLimit } from "@/server/ratelimit";
import { ACCENTS } from "@/lib/levels";
import { randomToken, sha256 } from "@/lib/crypto";
import { env } from "@/lib/env";

export type FormState = { error?: string; ok?: string } | undefined;

export async function saveProfile(_: FormState, form: FormData): Promise<FormState> {
  const user = await userOrThrow();
  const p = z
    .object({
      firstName: z.string().trim().min(1, "First name is required.").max(50),
      lastName: z.string().trim().min(1, "Last name is required.").max(50),
      displayName: z.string().trim().max(40).optional(),
      school: z.string().trim().max(120).optional(),
      grade: z.coerce.number().int().min(6).max(13),
      dailyStudyMinutes: z.coerce.number().int().refine((n) => [10, 20, 30, 45, 60].includes(n)),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  await db
    .update(schema.profiles)
    .set({ ...p.data, displayName: p.data.displayName || p.data.firstName, school: p.data.school || null, updatedAt: new Date() })
    .where(eq(schema.profiles.userId, user.id));
  revalidatePath("/", "layout");
  return { ok: "Saved" };
}

/** Accent colors unlock by level; the server checks XP so the lock can't be bypassed. */
export async function setAccent(id: string) {
  const user = await userOrThrow();
  const accent = ACCENTS.find((a) => a.id === id);
  if (!accent) return;
  const xp = await xpSummary(user.id, user.profile!.timezone);
  if (xp.level.level < accent.unlockLevel) return;
  await db.update(schema.profiles).set({ accentColor: id }).where(eq(schema.profiles.userId, user.id));
  revalidatePath("/", "layout");
}

const PREF_KEYS = ["chapterAnnouncements", "checkinOpen", "streakReminder", "competitionCountdown", "weeklyRecapEmail", "competitionReminderEmails", "productUpdatesEmail"] as const;
export async function setNotificationPref(key: string, value: boolean) {
  const user = await userOrThrow();
  if (!(PREF_KEYS as readonly string[]).includes(key)) return;
  await db
    .insert(schema.notificationPrefs)
    .values({ userId: user.id, [key]: value })
    .onConflictDoUpdate({ target: schema.notificationPrefs.userId, set: { [key]: value, updatedAt: new Date() } });
  revalidatePath("/profile");
}

export async function setPrivacy(key: "hideNameOnTrophies" | "shareActivityWithChapter", value: boolean) {
  const user = await userOrThrow();
  if (!["hideNameOnTrophies", "shareActivityWithChapter"].includes(key)) return;
  await db.update(schema.profiles).set({ [key]: value }).where(eq(schema.profiles.userId, user.id));
  revalidatePath("/profile");
}

export async function setLeaderboardVisibility(value: string) {
  const user = await userOrThrow();
  if (!["hidden", "pseudonym", "name"].includes(value)) return;
  await db.update(schema.profiles).set({ leaderboardVisibility: value }).where(eq(schema.profiles.userId, user.id));
  revalidatePath("/profile");
  revalidatePath("/leaderboard");
}

/* ───────── Family sharing ───────── */

export async function inviteParent(_: FormState, form: FormData): Promise<FormState> {
  const user = await userOrThrow();
  const email = z.string().trim().email().max(254).safeParse(form.get("email"));
  if (!email.success) return { error: "Enter a valid email address." };
  if (email.data.toLowerCase() === user.email.toLowerCase()) return { error: "Use a parent or guardian's email, not your own." };
  if (!(await rateLimit(`family:${user.id}`, 5, 86400))) return { error: "You've sent several invites today. Try again tomorrow." };
  const token = randomToken();
  await db
    .insert(schema.familyLinks)
    .values({ studentId: user.id, parentEmail: email.data.toLowerCase(), tokenHash: sha256(token), status: "pending" })
    .onConflictDoUpdate({ target: schema.familyLinks.studentId, set: { parentEmail: email.data.toLowerCase(), tokenHash: sha256(token), status: "pending", confirmedAt: null } });
  const name = user.profile!.firstName;
  await sendEmail({
    to: email.data,
    template: "family_invite",
    subject: `${name} invited you to a monthly PrepX progress email`,
    text: `Hi,\n\n${name} uses PrepX to prepare for competitive events and would like to send you a short progress email once a month: days practiced, study streak, practice-test accuracy and practice judge scores.\n\nYou'll never receive their messages, AI conversations or written responses.\n\nTo start the monthly email, confirm here:\n${env.appUrl}/family/confirm?token=${token}\n\nIf you don't recognize this, ignore this email and nothing will be sent.\n\nPrepX · ${env.supportEmail}`,
  });
  revalidatePath("/profile");
  return { ok: "Invite sent. They'll start getting emails after they confirm." };
}

export async function removeParent() {
  const user = await userOrThrow();
  await db.delete(schema.familyLinks).where(eq(schema.familyLinks.studentId, user.id));
  revalidatePath("/profile");
}

/* ───────── Push ───────── */

export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  const user = await userOrThrow();
  const p = z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) }).safeParse(sub);
  if (!p.success) return;
  await db
    .insert(schema.pushSubscriptions)
    .values({ userId: user.id, endpoint: p.data.endpoint, p256dh: p.data.keys.p256dh, auth: p.data.keys.auth })
    .onConflictDoUpdate({ target: schema.pushSubscriptions.endpoint, set: { userId: user.id, p256dh: p.data.keys.p256dh, auth: p.data.keys.auth } });
}

/* ───────── Feedback / ambassador ───────── */

export async function submitFeedback(_: FormState, form: FormData): Promise<FormState> {
  const user = await userOrThrow();
  const p = z
    .object({ kind: z.enum(["bug", "idea", "content_report", "ambassador"]), body: z.string().trim().min(5, "Tell us a little more.").max(5000), page: z.string().max(200).optional() })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  if (!(await rateLimit(`feedback:${user.id}`, 10, 86400))) return { error: "Thanks! You've sent a lot today; try again tomorrow." };
  await db.insert(schema.feedback).values({ userId: user.id, kind: p.data.kind, body: p.data.body, context: { page: p.data.page ?? null } });
  return { ok: p.data.kind === "ambassador" ? "Thanks for applying! We'll be in touch by email." : "Thanks! We read every message." };
}

/* ───────── Account deletion ───────── */

export async function deleteMyAccount(_: FormState, form: FormData): Promise<FormState> {
  // Works mid-onboarding too, so anyone who can sign in can delete their account.
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (String(form.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") return { error: 'Type DELETE to confirm.' };
  try {
    await deleteAccount(user.id, "user_request");
  } catch (e) {
    if (e instanceof SubscriptionCancelError) return { error: "We couldn't cancel your subscription, so nothing was deleted. Please try again in a few minutes." };
    throw e;
  }
  await destroySession();
  redirect("/sign-in?deleted=1");
}

/** "Cancel sign-up" on the onboarding screens: deletes an account that hasn't finished onboarding. */
export async function cancelSignUp(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  // A finished account is deleted only from Profile, with the typed confirmation.
  if (user.profile?.onboardingCompletedAt) redirect("/");
  await deleteAccount(user.id, "sign_up_cancelled");
  await destroySession();
  redirect("/sign-in");
}

export async function signOut() {
  await destroySession();
  redirect("/sign-in");
}

export async function markNotificationsRead() {
  const user = await userOrThrow();
  await db.execute(sql`update notifications set read_at = now() where user_id = ${user.id} and read_at is null`);
  revalidatePath("/notifications");
  revalidatePath("/");
}
