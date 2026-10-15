import { describe, expect, it } from "vitest";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { evaluatePerformance, generateScenario, ScenarioSchema } from "@/server/ai/tasks";
import { withUsage } from "@/server/ai/run";
import { getAllowance } from "@/server/entitlements";
import { handleStripeWebhook } from "@/server/billing";
import { calendarItems } from "@/server/calendar";
import { cleanup, streakReminders } from "@/server/jobs";
import { recordActivity, awardXp } from "@/server/progress";
import { makeUser, selectEvent } from "../support/factory";

describe("AI judge (test provider)", () => {
  it("generates a schema-valid scenario and scores only the event's rubric criteria", async () => {
    const [event] = await db.select().from(schema.events).where(eq(schema.events.id, "deca-pbm"));
    const sc = await generateScenario(event);
    expect(ScenarioSchema.safeParse(sc).success).toBe(true);
    const rubric = event.rubric.map((r) => ({ id: r.id, label: r.label, description: r.description }));
    const long = "Good afternoon. I recommend a three-part retention plan with mentoring, flexible schedules and a summer bonus because turnover costs about $600 per hire and we lost 40 percent of staff.";
    const res = await evaluatePerformance({ event, rubric, rubricBasis: "general", context: sc.situation, response: long });
    expect(res.criteria.map((c) => c.id)).toEqual(rubric.map((r) => r.id));
    expect(res.score).toBeGreaterThan(0);
    const short = await evaluatePerformance({ event, rubric, rubricBasis: "general", context: sc.situation, response: "Hi." });
    expect(short.score).toBe(0);
  });

  it("refunds the allowance when the AI call fails", async () => {
    const u = await makeUser();
    const [event] = await db.select().from(schema.events).where(eq(schema.events.id, "deca-pbm"));
    await expect(
      withUsage(u.id, "judge_run", "UTC", () => evaluatePerformance({ event, rubric: event.rubric, rubricBasis: "general", context: "x", response: "fail-ai please" })),
    ).rejects.toThrow();
    expect((await getAllowance(u.id, "judge_run", "UTC")).remaining).toBe(1);
  });
});

describe("Stripe webhooks", () => {
  const stripe = new Stripe("sk_test_dummy");
  const sign = (payload: string, secret = "whsec_test_dummy") => stripe.webhooks.generateTestHeaderString({ payload, secret });

  it("rejects bad signatures and applies valid events idempotently", async () => {
    const u = await makeUser();
    const event = {
      id: `evt_${Date.now()}`,
      object: "event",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_1", object: "subscription", customer: "cus_1", status: "active", cancel_at_period_end: false, metadata: { userId: u.id }, items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30 }] } } },
    };
    const payload = JSON.stringify(event);
    await expect(handleStripeWebhook(payload, sign(payload, "whsec_wrong"))).rejects.toThrow();
    await expect(handleStripeWebhook(payload, null)).rejects.toThrow();
    expect(await handleStripeWebhook(payload, sign(payload))).toEqual({ duplicate: false });
    expect(await handleStripeWebhook(payload, sign(payload))).toEqual({ duplicate: true });
    const [sub] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, u.id));
    expect(sub).toMatchObject({ status: "active", subscriptionId: "sub_1", kind: "subscription" });
  });
});

describe("calendar", () => {
  it("shows official dates only for opted-in orgs, plus personal milestones", async () => {
    const u = await makeUser();
    await db.insert(schema.orgPreferences).values([
      { userId: u.id, org: "deca", showDates: true },
      { userId: u.id, org: "fbla", showDates: false },
    ]);
    await selectEvent(u.id, "deca-pbm");
    const items = await calendarItems(u.id, "America/Chicago");
    const comps = items.filter((i) => i.kind === "competition");
    expect(comps.some((c) => c.id === "deca-icdc-2027")).toBe(true);
    expect(comps.some((c) => c.org === "fbla")).toBe(false);
    expect(items.filter((i) => i.kind === "milestone")).toHaveLength(4);
  });
});

describe("scheduled jobs", () => {
  it("sends streak reminders at 6pm local only to students who haven't practiced", async () => {
    const u = await makeUser({ tz: "America/New_York" });
    await db.insert(schema.activityDays).values({ userId: u.id, day: "2026-10-08" });
    const sixPmNY = new Date("2026-10-09T22:00:00Z");
    await streakReminders(sixPmNY);
    const n = await db.select().from(schema.notifications).where(eq(schema.notifications.userId, u.id));
    expect(n.some((x) => x.kind === "streak")).toBe(true);
    // Running again the same day doesn't duplicate.
    await streakReminders(sixPmNY);
    expect((await db.select().from(schema.notifications).where(eq(schema.notifications.userId, u.id))).filter((x) => x.kind === "streak")).toHaveLength(1);
  });

  it("sends streak reminders at the student's own reminder hour instead of 6pm", async () => {
    const u = await makeUser({ tz: "America/New_York" });
    await db.update(schema.profiles).set({ studyReminderTime: "07:30" }).where(eq(schema.profiles.userId, u.id));
    await db.insert(schema.activityDays).values({ userId: u.id, day: "2026-10-08" });
    const streak = async () => (await db.select().from(schema.notifications).where(eq(schema.notifications.userId, u.id))).filter((x) => x.kind === "streak");
    await streakReminders(new Date("2026-10-09T22:00:00Z")); // 6pm New York
    expect(await streak()).toHaveLength(0);
    await streakReminders(new Date("2026-10-09T11:00:00Z")); // 7am New York
    expect(await streak()).toHaveLength(1);
  });

  it("skips streak reminders on the student's rest days", async () => {
    const u = await makeUser({ tz: "America/New_York" });
    // 2026-10-09 is a Friday: a rest day in this plan.
    await db.update(schema.profiles).set({ studyDays: { mon: 30, tue: 30, wed: 30, thu: 30, fri: 0, sat: 45, sun: 0 } }).where(eq(schema.profiles.userId, u.id));
    await db.insert(schema.activityDays).values({ userId: u.id, day: "2026-10-08" });
    const streak = async () => (await db.select().from(schema.notifications).where(eq(schema.notifications.userId, u.id))).filter((x) => x.kind === "streak");
    await streakReminders(new Date("2026-10-09T22:00:00Z")); // Friday 6pm New York
    expect(await streak()).toHaveLength(0);
    await db.insert(schema.activityDays).values({ userId: u.id, day: "2026-10-09" }); // practiced anyway on Friday
    await streakReminders(new Date("2026-10-10T22:00:00Z")); // Saturday 6pm New York: a study day
    expect(await streak()).toHaveLength(1);
  });

  it("deletes AI conversations older than 180 days", async () => {
    const u = await makeUser();
    const [s] = await db.insert(schema.aiSessions).values({ userId: u.id, kind: "coach", title: "old", updatedAt: new Date(Date.now() - 200 * 86400_000) }).returning();
    await cleanup();
    expect(await db.select().from(schema.aiSessions).where(eq(schema.aiSessions.id, s.id))).toHaveLength(0);
  });
});

describe("referrals", () => {
  it("credits the inviter once, when the invited friend first studies", async () => {
    const inviter = await makeUser();
    const friend = await makeUser();
    await db.update(schema.profiles).set({ referredBy: inviter.id }).where(eq(schema.profiles.userId, friend.id));
    await recordActivity(friend.id, "UTC");
    await recordActivity(friend.id, "UTC");
    const xp = await db.select().from(schema.xpEvents).where(eq(schema.xpEvents.userId, inviter.id));
    expect(xp.filter((x) => x.reason === "referral")).toHaveLength(1);
    await awardXp(inviter.id, 100, "referral", friend.id);
    expect((await db.select().from(schema.xpEvents).where(eq(schema.xpEvents.userId, inviter.id))).filter((x) => x.reason === "referral")).toHaveLength(1);
  });
});
