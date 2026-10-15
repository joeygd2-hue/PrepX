import { afterEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { and, eq, getTableName, inArray, is, sql } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { db, schema } from "@/db";
import type { CurrentUser } from "@/server/auth/session";
import { deleteAccount, exportAccount } from "@/server/account";
import { CheckoutRefusedError, createCheckout, handleStripeWebhook, stripe, SubscriptionCancelError } from "@/server/billing";
import { createChapter } from "@/server/chapters";
import { cleanup } from "@/server/jobs";
import { env } from "@/lib/env";
import { POST as stripeWebhook } from "@/app/api/stripe/webhook/route";
import { cancelSignUp, deleteMyAccount } from "@/app/actions/profile";
import { makeUser } from "../support/factory";

// Server actions read the signed-in user from the request; tests set it directly.
const auth = vi.hoisted(() => ({ user: null as CurrentUser | null }));
vi.mock("@/server/auth/session", () => ({
  getCurrentUser: async () => auth.user,
  userOrThrow: async () => {
    if (!auth.user?.profile?.onboardingCompletedAt) throw new Error("Unauthorized");
    return auth.user;
  },
  destroySession: async () => {
    auth.user = null;
  },
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const signer = new Stripe("sk_test_dummy");
const sign = (payload: string) => signer.webhooks.generateTestHeaderString({ payload, secret: "whsec_test_dummy" });
const client = stripe()!;
const rand = () => Math.random().toString(36).slice(2, 9);

afterEach(() => {
  vi.restoreAllMocks();
  auth.user = null;
});

async function signIn(userId: string) {
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId));
  auth.user = { id: u.id, email: u.email, role: u.role, emailVerified: true, profile: profile ?? null };
}

/** A user who signed in but never finished onboarding (as created at sign-in). */
async function makeUnfinishedUser(createdAt = new Date(), withProfile = true) {
  const [u] = await db.insert(schema.users).values({ email: `unfinished_${rand()}@prepx.test`, emailVerifiedAt: new Date(), createdAt }).returning();
  if (withProfile) await db.insert(schema.profiles).values({ userId: u.id, onboardingStep: "name", birthDate: "2010-01-01" });
  return u;
}

const userExists = async (id: string) => (await db.select().from(schema.users).where(eq(schema.users.id, id))).length === 1;

/** Answers Stripe's subscription listing for a customer. */
const listSubscriptions = (subs: { id: string; status: string }[]) =>
  vi.spyOn(client.subscriptions, "list").mockImplementation(
    () =>
      (async function* () {
        yield* subs;
      })() as never,
  );

function subscriptionEvent(userId: string, sub: { id: string; status: string; customer?: string }, type = "customer.subscription.updated") {
  return JSON.stringify({
    id: `evt_${rand()}`,
    object: "event",
    type,
    data: {
      object: {
        id: sub.id,
        object: "subscription",
        customer: sub.customer ?? "cus_test",
        status: sub.status,
        cancel_at_period_end: false,
        metadata: { userId },
        items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30 }] },
      },
    },
  });
}

function boostEvent(userId: string, customer: string | null = null) {
  return JSON.stringify({
    id: `evt_${rand()}`,
    object: "event",
    type: "checkout.session.completed",
    data: { object: { id: `cs_${rand()}`, object: "checkout.session", customer, payment_status: "paid", metadata: { userId, kind: "season_boost" } } },
  });
}

const webhookRequest = (payload: string, signature = sign(payload)) =>
  new Request("http://localhost/api/stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": signature } });

const subscriptionRow = async (userId: string) => (await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId)))[0];

describe("Stripe webhook processing", () => {
  it("returns 500 and records nothing when applying fails, so the retry applies it once", async () => {
    const u = await makeUser();
    const payload = subscriptionEvent(u.id, { id: `sub_${rand()}`, status: "active" });
    const eventId = JSON.parse(payload).id as string;
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    // Simulate a database failure while the subscription row is written.
    await db.execute(sql.raw(`create or replace function test_fail_subscription_write() returns trigger language plpgsql as $$ begin raise exception 'simulated outage'; end $$`));
    await db.execute(sql.raw(`create trigger test_fail_subscription_write before insert or update on subscriptions for each row when (new.user_id = '${u.id}') execute function test_fail_subscription_write()`));
    try {
      const failed = await stripeWebhook(webhookRequest(payload));
      expect(failed.status).toBe(500);
      expect(errors).toHaveBeenCalled();
    } finally {
      await db.execute(sql.raw(`drop trigger if exists test_fail_subscription_write on subscriptions`));
      await db.execute(sql.raw(`drop function if exists test_fail_subscription_write()`));
    }
    expect(await db.select().from(schema.billingEvents).where(eq(schema.billingEvents.id, eventId))).toHaveLength(0);
    expect(await subscriptionRow(u.id)).toBeUndefined();

    const retry = await stripeWebhook(webhookRequest(payload));
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual({ received: true, duplicate: false });
    expect(await subscriptionRow(u.id)).toMatchObject({ status: "active", kind: "subscription" });
    const [recorded] = await db.select().from(schema.billingEvents).where(eq(schema.billingEvents.id, eventId));
    expect(recorded.userId).toBe(u.id);

    // A duplicate delivery is acknowledged without being applied again.
    await db.update(schema.subscriptions).set({ status: "past_due" }).where(eq(schema.subscriptions.userId, u.id));
    const duplicate = await stripeWebhook(webhookRequest(payload));
    expect(duplicate.status).toBe(200);
    expect(await duplicate.json()).toEqual({ received: true, duplicate: true });
    expect((await subscriptionRow(u.id)).status).toBe("past_due");
  });

  it("answers 400 to a bad signature", async () => {
    const payload = subscriptionEvent((await makeUser()).id, { id: "sub_sig", status: "active" });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await stripeWebhook(webhookRequest(payload, "t=1,v1=bad"))).status).toBe(400);
  });

  it("never lets a season boost replace a subscription that can still bill", async () => {
    const u = await makeUser();
    await db.insert(schema.subscriptions).values({ userId: u.id, customerId: "cus_live", subscriptionId: "sub_live", kind: "subscription", status: "past_due" });
    const payload = boostEvent(u.id, "cus_live");
    expect(await handleStripeWebhook(payload, sign(payload))).toEqual({ duplicate: false });
    expect(await subscriptionRow(u.id)).toMatchObject({ kind: "subscription", subscriptionId: "sub_live", status: "past_due" });
    const csId = JSON.parse(payload).data.object.id as string;
    const flagged = await db.select().from(schema.errorLog).where(eq(schema.errorLog.scope, "billing"));
    expect(flagged.some((e) => e.message.includes(csId))).toBe(true);
  });

  it("keeps the customer on a boost row and ignores late events for an ended subscription", async () => {
    const u = await makeUser();
    await db.insert(schema.subscriptions).values({ userId: u.id, customerId: "cus_old", subscriptionId: "sub_old", kind: "subscription", status: "canceled" });
    const boost = boostEvent(u.id);
    await handleStripeWebhook(boost, sign(boost));
    expect(await subscriptionRow(u.id)).toMatchObject({ kind: "season_boost", status: "active", customerId: "cus_old", subscriptionId: null });
    const late = subscriptionEvent(u.id, { id: "sub_old", status: "canceled", customer: "cus_old" }, "customer.subscription.deleted");
    await handleStripeWebhook(late, sign(late));
    expect(await subscriptionRow(u.id)).toMatchObject({ kind: "season_boost", status: "active" });
  });
});

describe("season boost checkout", () => {
  const price = env.stripe.priceSeasonBoost;
  afterEach(() => {
    env.stripe.priceSeasonBoost = price;
  });

  it("is refused while a recurring subscription hasn't ended", async () => {
    env.stripe.priceSeasonBoost = "price_boost_test";
    const create = vi.spyOn(client.checkout.sessions, "create");
    const u = await makeUser();
    await db.insert(schema.subscriptions).values({ userId: u.id, customerId: "cus_pd", subscriptionId: "sub_pd", kind: "subscription", status: "past_due" });
    const refused = createCheckout(u.id, u.email, "season_boost");
    await expect(refused).rejects.toBeInstanceOf(CheckoutRefusedError);
    await expect(refused).rejects.toMatchObject({ code: "subscription_open", message: expect.stringContaining("Manage or cancel subscription") });

    // The local row can be stale (an earlier boost replaced it), so Stripe is asked too.
    const v = await makeUser();
    await db.insert(schema.subscriptions).values({ userId: v.id, customerId: "cus_hidden", kind: "season_boost", status: "active" });
    const list = listSubscriptions([{ id: "sub_hidden", status: "active" }]);
    await expect(createCheckout(v.id, v.email, "season_boost")).rejects.toBeInstanceOf(CheckoutRefusedError);
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ customer: "cus_hidden" }));
    expect(create).not.toHaveBeenCalled();
  });

  it("is allowed once the subscription has ended", async () => {
    env.stripe.priceSeasonBoost = "price_boost_test";
    const create = vi.spyOn(client.checkout.sessions, "create").mockResolvedValue({ url: "https://checkout.stripe.test/s" } as never);
    listSubscriptions([{ id: "sub_done", status: "canceled" }]);
    const u = await makeUser();
    await db.insert(schema.subscriptions).values({ userId: u.id, customerId: "cus_done", subscriptionId: "sub_done", kind: "subscription", status: "canceled" });
    expect(await createCheckout(u.id, u.email, "season_boost")).toBe("https://checkout.stripe.test/s");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ mode: "payment", customer: "cus_done" }));
  });
});

describe("account deletion and billing", () => {
  it("cancels every open subscription of the Stripe customer, not just the stored one", async () => {
    const u = await makeUser();
    await db.insert(schema.subscriptions).values({ userId: u.id, customerId: "cus_del", kind: "season_boost", status: "active" });
    const list = listSubscriptions([
      { id: "sub_open", status: "past_due" },
      { id: "sub_expired", status: "incomplete_expired" },
    ]);
    const cancel = vi.spyOn(client.subscriptions, "cancel").mockResolvedValue({} as never);
    await deleteAccount(u.id, "test");
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ customer: "cus_del" }));
    expect(cancel.mock.calls.map((c) => c[0])).toEqual(["sub_open"]);
    expect(await userExists(u.id)).toBe(false);
  });

  it("deletes nothing and tells the user when the subscription can't be cancelled", async () => {
    const u = await makeUser();
    const officer = await makeUser();
    const c = await createChapter(u.id, { org: "deca", name: `Keep ${rand()}`, school: "S" });
    await db.insert(schema.chapterMembers).values({ chapterId: c.id, userId: officer.id, org: "deca", role: "officer" });
    await db.insert(schema.subscriptions).values({ userId: u.id, customerId: "cus_fail", subscriptionId: "sub_fail", kind: "subscription", status: "active" });
    await db.insert(schema.feedback).values({ userId: u.id, kind: "idea", body: "Keep me until deletion succeeds" });
    await db.insert(schema.emailLog).values({ to: u.email, template: "weekly_recap", subject: "Recap", status: "sent" });
    listSubscriptions([{ id: "sub_fail", status: "active" }]);
    vi.spyOn(client.subscriptions, "cancel").mockRejectedValue(new Error("Stripe is unavailable"));

    await expect(deleteAccount(u.id, "test")).rejects.toBeInstanceOf(SubscriptionCancelError);
    expect(await userExists(u.id)).toBe(true);
    const members = await db.select().from(schema.chapterMembers).where(eq(schema.chapterMembers.chapterId, c.id));
    expect(members.find((m) => m.userId === u.id)?.role).toBe("advisor");
    expect(members.find((m) => m.userId === officer.id)?.role).toBe("officer");
    expect(await db.select().from(schema.feedback).where(eq(schema.feedback.userId, u.id))).toHaveLength(1);
    expect(await db.select().from(schema.emailLog).where(eq(schema.emailLog.to, u.email))).toHaveLength(1);

    await signIn(u.id);
    const form = new FormData();
    form.set("confirm", "DELETE");
    expect(await deleteMyAccount(undefined, form)).toEqual({ error: expect.stringContaining("nothing was deleted") });
    expect(await userExists(u.id)).toBe(true);
    expect(auth.user).not.toBeNull();
  });
});

describe("account deletion removes email-keyed data and feedback", () => {
  it("removes the delivery log, sign-in codes and rate limits for the user's and parent's addresses", async () => {
    const u = await makeUser();
    const email = u.email.toLowerCase();
    const parent = `parent_${rand()}@prepx.test`;
    const other = `other_${rand()}@prepx.test`;
    await db.insert(schema.familyLinks).values({ studentId: u.id, parentEmail: parent, tokenHash: "x", status: "confirmed" });
    await db.insert(schema.emailLog).values([
      { to: email.toUpperCase(), template: "sign_in_code", subject: "Code", status: "logged" },
      { to: parent, template: "parent_monthly", subject: "Month", status: "sent" },
      { to: other, template: "sign_in_code", subject: "Code", status: "logged" },
    ]);
    await db.insert(schema.emailCodes).values([
      { email, codeHash: "h1", purpose: "sign_in", expiresAt: new Date(Date.now() + 600_000) },
      { email: other, codeHash: "h2", purpose: "sign_in", expiresAt: new Date(Date.now() + 600_000) },
    ]);
    const keys = { mine: `code:email:${email}`, longer: `code:email:x${email}`, other: `code:email:${other}` };
    await db.insert(schema.rateLimits).values(Object.values(keys).map((key) => ({ key, windowStart: new Date(), count: 1 })));
    await db.insert(schema.feedback).values({ userId: u.id, kind: "ambassador", body: "My school is Example High" });

    await deleteAccount(u.id, "test");

    const logged = await db.select({ to: schema.emailLog.to }).from(schema.emailLog).where(inArray(sql`lower(${schema.emailLog.to})`, [email, parent, other]));
    expect(logged.map((r) => r.to)).toEqual([other]);
    const codes = await db.select({ email: schema.emailCodes.email }).from(schema.emailCodes).where(inArray(schema.emailCodes.email, [email, other]));
    expect(codes.map((r) => r.email)).toEqual([other]);
    const limits = await db.select({ key: schema.rateLimits.key }).from(schema.rateLimits).where(inArray(schema.rateLimits.key, Object.values(keys)));
    expect(limits.map((r) => r.key).sort()).toEqual([keys.longer, keys.other].sort());
    expect(await db.select().from(schema.feedback).where(eq(schema.feedback.body, "My school is Example High"))).toHaveLength(0);
  });
});

/** Tables that reference users.id, and where each is exported. A new user table must be added to one of these lists. */
const EXPORTED: Record<string, string> = {
  question_bookmarks: "questionBookmarks",
  duels: "duelsCreated",
  duel_entries: "duelEntries",
  users: "account",
  sessions: "sessions",
  profiles: "profile",
  org_preferences: "organizationPreferences",
  notification_prefs: "notificationPreferences",
  push_subscriptions: "pushSubscriptions",
  event_selections: "eventSelections",
  plan_tasks: "studyPlanTasks",
  season_goals: "seasonGoals",
  exam_attempts: "examAttempts",
  attempt_answers: "answers",
  mistakes: "mistakeNotebook",
  lesson_progress: "lessonProgress",
  flashcard_reviews: "flashcardReviews",
  sprint_bests: "sprintBests",
  ai_sessions: "aiSessions",
  ai_feedback: "aiFeedback",
  xp_events: "xp",
  activity_days: "activityDays",
  user_achievements: "achievements",
  buddies: "buddies",
  chapter_members: "chapterMemberships",
  chapter_announcements: "chapterAnnouncementsPosted",
  checkin_records: "checkins",
  quiz_answers: "quizAnswers",
  announcement_dismissals: "announcementDismissals",
  notifications: "notifications",
  family_links: "familyLink",
  usage_records: "usage",
  subscriptions: "subscription",
  billing_events: "paymentEvents",
  feedback: "feedback",
};
const EXCLUDED: Record<string, string> = {
  app_settings: "updated_by only records which admin last changed a site setting",
  questions: "created_by marks staff-written question content",
  chapters: "the chapter belongs to its members; the user's own membership and role are in chapterMemberships",
  checkins: "a check-in window belongs to the chapter; the user's own check-ins are in checkins",
  quiz_games: "a quiz game belongs to the chapter; the user's own answers are in quizAnswers",
  announcements: "staff-written product announcements",
  audit_log: "security audit trail of actions, not profile data",
  email_log: "short-lived delivery log (30 days), keyed by address and removed on deletion",
  email_codes: "hashed sign-in codes that expire in 10 minutes",
  rate_limits: "abuse-prevention counters kept up to 2 days",
};

describe("data export", () => {
  it("covers every table that references a user, or says why not", async () => {
    const tables = Object.values(schema as Record<string, unknown>).filter((v): v is PgTable => is(v, PgTable));
    const names = tables.map((t) => getTableName(t));
    const userTables = tables
      .filter((t) => getTableName(t) === "users" || getTableConfig(t).foreignKeys.some((fk) => getTableName(fk.reference().foreignTable) === "users"))
      .map((t) => getTableName(t));
    expect(userTables.filter((t) => !(t in EXPORTED) && !(t in EXCLUDED))).toEqual([]);
    expect([...Object.keys(EXPORTED), ...Object.keys(EXCLUDED)].filter((t) => !names.includes(t))).toEqual([]);
    const exported = await exportAccount((await makeUser()).id);
    expect(Object.keys(exported)).toEqual(expect.arrayContaining(Object.values(EXPORTED)));
  });

  it("includes the newer user tables without secrets", async () => {
    const u = await makeUser();
    const pat = await makeUser({ first: "Pat" });
    const sam = await makeUser({ first: "Sam" });
    await db.insert(schema.sessions).values({ id: `tokenhash_${rand()}`, userId: u.id, expiresAt: new Date(Date.now() + 86400_000), userAgent: "Test Browser" });
    await db.insert(schema.pushSubscriptions).values({ userId: u.id, endpoint: `https://push.example/${rand()}`, p256dh: "secret-p256dh", auth: "secret-auth" });
    await db.insert(schema.buddies).values([
      { requesterId: u.id, addresseeId: pat.id, status: "accepted" },
      { requesterId: sam.id, addresseeId: u.id },
    ]);
    await db.insert(schema.sprintBests).values({ userId: u.id, clusterId: "deca-bac", best: 12 });
    const c = await createChapter(u.id, { org: "deca", name: `Export ${rand()}`, school: "S" });
    const [game] = await db.insert(schema.quizGames).values({ chapterId: c.id, hostId: u.id, clusterId: "deca-bac", questionIds: [] }).returning();
    await db.insert(schema.quizAnswers).values({ gameId: game.id, userId: u.id, questionIndex: 0, chosenIndex: 2, correct: true, points: 90 });
    await db.insert(schema.chapterAnnouncements).values({ chapterId: c.id, authorId: u.id, title: "Practice moved", body: "Thursday instead" });
    const [ann] = await db.insert(schema.announcements).values({ title: "News", body: "Body" }).returning();
    await db.insert(schema.announcementDismissals).values({ userId: u.id, announcementId: ann.id });
    await db.insert(schema.feedback).values({ userId: u.id, kind: "bug", body: "The timer froze" });

    const exported = await exportAccount(u.id);
    expect(exported.sessions).toEqual([{ createdAt: expect.any(Date), expiresAt: expect.any(Date), userAgent: "Test Browser" }]);
    expect(exported.pushSubscriptions).toEqual([{ endpoint: expect.stringContaining("https://push.example/"), createdAt: expect.any(Date) }]);
    expect(JSON.stringify(exported)).not.toMatch(/tokenhash_|secret-p256dh|secret-auth/);
    expect(exported.buddies.requestsSent).toEqual([expect.objectContaining({ buddy: "Pat", status: "accepted" })]);
    expect(exported.buddies.requestsReceived).toEqual([expect.objectContaining({ buddy: "Sam", status: "pending" })]);
    expect(exported.sprintBests).toEqual([expect.objectContaining({ clusterId: "deca-bac", best: 12 })]);
    expect(exported.quizAnswers).toEqual([expect.objectContaining({ gameId: game.id, points: 90 })]);
    expect(exported.chapterAnnouncementsPosted).toEqual([expect.objectContaining({ chapterId: c.id, title: "Practice moved" })]);
    expect(exported.announcementDismissals).toEqual([expect.objectContaining({ announcementId: ann.id })]);
    expect(exported.feedback).toEqual([expect.objectContaining({ kind: "bug", body: "The timer froze" })]);
  });
});

describe("unfinished sign-ups", () => {
  it("are deleted by the daily cleanup after 7 days, not before", async () => {
    const day = 86400_000;
    const stale = await makeUnfinishedUser(new Date(Date.now() - 8 * day));
    const noProfile = await makeUnfinishedUser(new Date(Date.now() - 8 * day), false);
    const recent = await makeUnfinishedUser(new Date(Date.now() - 6 * day));
    const finished = await makeUser();
    await db.update(schema.users).set({ createdAt: new Date(Date.now() - 30 * day) }).where(eq(schema.users.id, finished.id));
    await db.insert(schema.emailLog).values({ to: stale.email, template: "sign_in_code", subject: "Code", status: "logged" });

    const result = await cleanup();
    expect(result.abandonedSignUpsDeleted).toBeGreaterThanOrEqual(2);
    expect(await userExists(stale.id)).toBe(false);
    expect(await userExists(noProfile.id)).toBe(false);
    expect(await userExists(recent.id)).toBe(true);
    expect(await userExists(finished.id)).toBe(true);
    expect(await db.select().from(schema.emailLog).where(eq(schema.emailLog.to, stale.email))).toHaveLength(0);
    const audits = await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.action, "account_deleted"), sql`${schema.auditLog.meta}->>'reason' = 'abandoned_sign_up'`));
    expect(audits.length).toBeGreaterThanOrEqual(2);
  });

  it("can be cancelled by the user, but a finished account can't be deleted that way", async () => {
    const done = await makeUser();
    await signIn(done.id);
    await expect(cancelSignUp()).rejects.toThrow(/^NEXT_REDIRECT \/$/);
    expect(await userExists(done.id)).toBe(true);

    const u = await makeUnfinishedUser();
    await signIn(u.id);
    await expect(cancelSignUp()).rejects.toThrow(/^NEXT_REDIRECT \/sign-in$/);
    expect(await userExists(u.id)).toBe(false);
    expect(auth.user).toBeNull();
  });

  it("can delete their account from the delete form before finishing onboarding", async () => {
    const u = await makeUnfinishedUser();
    await signIn(u.id);
    const form = new FormData();
    form.set("confirm", "nope");
    expect(await deleteMyAccount(undefined, form)).toEqual({ error: "Type DELETE to confirm." });
    expect(await userExists(u.id)).toBe(true);
    form.set("confirm", "delete");
    await expect(deleteMyAccount(undefined, form)).rejects.toThrow(/^NEXT_REDIRECT \/sign-in\?deleted=1$/);
    expect(await userExists(u.id)).toBe(false);
  });

  it("sends signed-out callers to sign-in", async () => {
    await expect(cancelSignUp()).rejects.toThrow(/^NEXT_REDIRECT \/sign-in$/);
    await expect(deleteMyAccount(undefined, new FormData())).rejects.toThrow(/^NEXT_REDIRECT \/sign-in$/);
  });
});
