import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

export type LaunchAccess = { active: boolean; endsOn: string | null };

/**
 * The free launch period: everyone gets Pro until the end of `endsOn`. The day ends at
 * midnight in UTC−10 (Hawaii), so students in every US time zone get the whole last day.
 */
export function launchAccessFrom(value: unknown, now: Date = new Date()): LaunchAccess {
  const endsOn = typeof value === "object" && value !== null && "endsOn" in value ? (value as { endsOn: unknown }).endsOn : null;
  if (typeof endsOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(endsOn)) return { active: false, endsOn: null };
  const end = new Date(`${endsOn}T23:59:59.999-10:00`);
  return { active: now <= end, endsOn };
}

export const getLaunchAccess = cache(async (): Promise<LaunchAccess> => {
  const [row] = await db.select().from(schema.appSettings).where(eq(schema.appSettings.key, "launch_access"));
  return launchAccessFrom(row?.value);
});

/** Sets (or, with null, ends) the launch period. Callers must authorize the admin first. */
export async function setLaunchAccess(endsOn: string | null, adminId: string) {
  const value = { endsOn };
  await db
    .insert(schema.appSettings)
    .values({ key: "launch_access", value, updatedBy: adminId })
    .onConflictDoUpdate({ target: schema.appSettings.key, set: { value, updatedBy: adminId, updatedAt: new Date() } });
}
