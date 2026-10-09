"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { userOrThrow } from "@/server/auth/session";
import { isOrg } from "@/lib/orgs";
import { US_STATES } from "@/lib/states";

async function upsert(userId: string, org: "deca" | "fbla" | "hosa" | "tsa", set: Partial<typeof schema.orgPreferences.$inferInsert>) {
  await db
    .insert(schema.orgPreferences)
    .values({ userId, org, ...set })
    .onConflictDoUpdate({ target: [schema.orgPreferences.userId, schema.orgPreferences.org], set: { ...set, updatedAt: new Date() } });
  revalidatePath("/calendar", "layout");
  revalidatePath("/");
}

export async function setShowDates(org: string, show: boolean) {
  const user = await userOrThrow();
  if (!isOrg(org)) return;
  await upsert(user.id, org, { showDates: show });
}

export async function setOrgState(org: string, state: string | null) {
  const user = await userOrThrow();
  if (!isOrg(org) || (state && !US_STATES.some(([c]) => c === state))) return;
  await upsert(user.id, org, { state, regionId: null });
}

export async function setOrgRegion(org: string, regionId: string | null) {
  const user = await userOrThrow();
  if (!isOrg(org)) return;
  if (regionId) {
    const [r] = await db.select().from(schema.regions).where(and(eq(schema.regions.id, regionId), eq(schema.regions.org, org)));
    if (!r) return;
    await upsert(user.id, org, { regionId, state: r.state });
  } else await upsert(user.id, org, { regionId: null });
}
