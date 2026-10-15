import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getAllowance, getPlanStatus } from "@/server/entitlements";
import { getLaunchAccess, launchAccessFrom, setLaunchAccess } from "@/server/settings";
import { makeUser } from "../support/factory";

const TZ = "America/Chicago";

describe("free launch period", () => {
  afterEach(async () => {
    await db.delete(schema.appSettings).where(eq(schema.appSettings.key, "launch_access"));
  });

  it("lasts through the whole last day in every US time zone", () => {
    const v = { endsOn: "2026-11-07" };
    expect(launchAccessFrom(v, new Date("2026-11-07T12:00:00Z")).active).toBe(true);
    // 11:30 pm in Honolulu on the last day is 09:30 UTC the next day.
    expect(launchAccessFrom(v, new Date("2026-11-08T09:30:00Z")).active).toBe(true);
    expect(launchAccessFrom(v, new Date("2026-11-08T10:00:01Z")).active).toBe(false);
    expect(launchAccessFrom(null).active).toBe(false);
    expect(launchAccessFrom({ endsOn: "soon" })).toEqual({ active: false, endsOn: null });
  });

  it("gives everyone Pro limits while active, then returns them to Free", async () => {
    const u = await makeUser();
    const admin = await makeUser();
    expect((await getPlanStatus(u.id)).isPro).toBe(false);

    await setLaunchAccess("2099-12-31", admin.id);
    expect(await getLaunchAccess()).toEqual({ active: true, endsOn: "2099-12-31" });
    expect(await getPlanStatus(u.id)).toEqual({ isPro: true, source: "launch", detail: "2099-12-31" });
    expect((await getAllowance(u.id, "judge_run", TZ)).limit).toBe(15);

    await setLaunchAccess("2020-01-01", admin.id);
    expect((await getPlanStatus(u.id)).isPro).toBe(false);
    await setLaunchAccess(null, admin.id);
    expect(await getPlanStatus(u.id)).toEqual({ isPro: false, source: null });
    expect((await getAllowance(u.id, "judge_run", TZ)).limit).toBe(1);
  });

  it("reports a paid subscription as the source, not the launch period", async () => {
    const u = await makeUser();
    const admin = await makeUser();
    await setLaunchAccess("2099-12-31", admin.id);
    await db.insert(schema.subscriptions).values({ userId: u.id, kind: "subscription", status: "active", currentPeriodEnd: new Date(Date.now() + 86400_000 * 20) });
    expect((await getPlanStatus(u.id)).source).toBe("subscription");
  });
});
