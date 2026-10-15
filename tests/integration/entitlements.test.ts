import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { commitUsage, getAllowance, getPlanStatus, LimitReachedError, refundUsage, reserveUsage } from "@/server/entitlements";
import { withUsage } from "@/server/ai/run";
import { makeUser } from "../support/factory";

const TZ = "America/Chicago";

describe("free-plan usage limits", () => {
  it("allows 1 judge run per day on free, then blocks", async () => {
    const u = await makeUser();
    const id = await reserveUsage(u.id, "judge_run", TZ);
    await commitUsage(id);
    await expect(reserveUsage(u.id, "judge_run", TZ)).rejects.toBeInstanceOf(LimitReachedError);
    const a = await getAllowance(u.id, "judge_run", TZ);
    expect(a).toMatchObject({ limit: 1, used: 1, remaining: 0 });
  });

  it("allows exactly 2 full practice exams per season on free", async () => {
    const u = await makeUser();
    for (let i = 0; i < 2; i++) await commitUsage(await reserveUsage(u.id, "full_exam", TZ));
    await expect(reserveUsage(u.id, "full_exam", TZ)).rejects.toBeInstanceOf(LimitReachedError);
  });

  it("allows 1 entry check and 1 presentation check on free", async () => {
    const u = await makeUser();
    await commitUsage(await reserveUsage(u.id, "entry_check", TZ));
    await commitUsage(await reserveUsage(u.id, "presentation_check", TZ));
    await expect(reserveUsage(u.id, "entry_check", TZ)).rejects.toBeInstanceOf(LimitReachedError);
    await expect(reserveUsage(u.id, "presentation_check", TZ)).rejects.toBeInstanceOf(LimitReachedError);
  });

  it("does not charge for a failed request (refund frees the allowance)", async () => {
    const u = await makeUser();
    await expect(
      withUsage(u.id, "judge_run", TZ, async () => {
        throw new Error("provider down");
      }),
    ).rejects.toThrow("provider down");
    expect((await getAllowance(u.id, "judge_run", TZ)).remaining).toBe(1);
    const id = await reserveUsage(u.id, "judge_run", TZ);
    await refundUsage(id);
    expect((await getAllowance(u.id, "judge_run", TZ)).remaining).toBe(1);
  });

  it("is race-safe: concurrent reservations never exceed the limit", async () => {
    const u = await makeUser();
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => reserveUsage(u.id, "judge_run", TZ)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });
});

describe("Pro entitlements", () => {
  it("grants Pro limits with an active subscription", async () => {
    const u = await makeUser();
    await db.insert(schema.subscriptions).values({ userId: u.id, kind: "subscription", status: "active", currentPeriodEnd: new Date(Date.now() + 86400_000 * 20) });
    expect((await getPlanStatus(u.id)).isPro).toBe(true);
    for (let i = 0; i < 3; i++) await commitUsage(await reserveUsage(u.id, "full_exam", TZ));
    expect((await getAllowance(u.id, "full_exam", TZ)).unlimited).toBe(true);
    expect((await getAllowance(u.id, "judge_run", TZ)).limit).toBe(15);
  });

  it("does not grant Pro for expired or canceled subscriptions", async () => {
    const u = await makeUser();
    await db.insert(schema.subscriptions).values({ userId: u.id, kind: "subscription", status: "active", currentPeriodEnd: new Date(Date.now() - 1000) });
    expect((await getPlanStatus(u.id)).isPro).toBe(false);
    await db.update(schema.subscriptions).set({ status: "canceled", currentPeriodEnd: new Date(Date.now() + 86400_000) }).where(eq(schema.subscriptions.userId, u.id));
    expect((await getPlanStatus(u.id)).isPro).toBe(false);
  });

  it("grants Pro through a chapter that covers Pro", async () => {
    const u = await makeUser();
    const [c] = await db.insert(schema.chapters).values({ org: "deca", name: "Covered", school: "S", joinCode: "PRO234", coversPro: true }).returning();
    await db.insert(schema.chapterMembers).values({ chapterId: c.id, userId: u.id, org: "deca" });
    expect(await getPlanStatus(u.id)).toMatchObject({ isPro: true, source: "chapter" });
  });
});
