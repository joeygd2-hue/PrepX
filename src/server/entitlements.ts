import "server-only";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { seasonKey, todayIn } from "@/lib/dates";

export type Feature =
  | "coach_message"
  | "judge_run"
  | "judge_questions"
  | "explain_back"
  | "full_exam"
  | "entry_check"
  | "presentation_check"
  | "lesson"
  | "flashcards";

export class LimitReachedError extends Error {
  constructor(public feature: Feature, public resetsLabel: string) {
    super("You've used your allowance for this feature.");
  }
}

export type PlanStatus = { isPro: boolean; source: "subscription" | "season_boost" | "chapter" | null; detail?: string };

export async function getPlanStatus(userId: string): Promise<PlanStatus> {
  const [sub] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId));
  const now = new Date();
  if (sub && ["active", "trialing"].includes(sub.status) && (!sub.currentPeriodEnd || sub.currentPeriodEnd > now)) {
    return { isPro: true, source: sub.kind === "season_boost" ? "season_boost" : "subscription" };
  }
  const covered = await db
    .select({ name: schema.chapters.name })
    .from(schema.chapterMembers)
    .innerJoin(schema.chapters, eq(schema.chapters.id, schema.chapterMembers.chapterId))
    .where(and(eq(schema.chapterMembers.userId, userId), eq(schema.chapters.coversPro, true)))
    .limit(1);
  if (covered[0]) return { isPro: true, source: "chapter", detail: covered[0].name };
  return { isPro: false, source: null };
}

function periodKey(period: string, tz: string) {
  const today = todayIn(tz);
  if (period === "day") return today;
  if (period === "month") return today.slice(0, 7);
  if (period === "season") return seasonKey(today);
  return "lifetime";
}

const resetLabel = (period: string) =>
  period === "day" ? "Resets at midnight" : period === "month" ? "Resets next month" : period === "season" ? "Resets next season (Aug 1)" : "Does not reset";

export type Allowance = { feature: Feature; label: string; limit: number; used: number; remaining: number; unlimited: boolean; resets: string; period: string };

export async function getAllowance(userId: string, feature: Feature, tz: string, plan?: PlanStatus): Promise<Allowance> {
  const [limitRow] = await db.select().from(schema.planLimits).where(eq(schema.planLimits.feature, feature));
  if (!limitRow) return { feature, label: feature, limit: -1, used: 0, remaining: Infinity, unlimited: true, resets: "", period: "day" };
  const p = plan ?? (await getPlanStatus(userId));
  const limit = p.isPro ? limitRow.proLimit : limitRow.freeLimit;
  const key = periodKey(limitRow.period, tz);
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.usageRecords)
    .where(
      and(
        eq(schema.usageRecords.userId, userId),
        eq(schema.usageRecords.feature, feature),
        eq(schema.usageRecords.periodKey, key),
        inArray(schema.usageRecords.status, ["reserved", "consumed"]),
      ),
    );
  const unlimited = limit < 0;
  return { feature, label: limitRow.label, limit, used: n, remaining: unlimited ? Infinity : Math.max(0, limit - n), unlimited, resets: resetLabel(limitRow.period), period: limitRow.period };
}

/**
 * Atomically reserves one unit of a feature. Call commitUsage() after the service was
 * delivered, or refundUsage() if it failed, so users are never charged for failures.
 */
export async function reserveUsage(userId: string, feature: Feature, tz: string, refId?: string) {
  const plan = await getPlanStatus(userId);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${userId}:${feature}`}))`);
    const [limitRow] = await tx.select().from(schema.planLimits).where(eq(schema.planLimits.feature, feature));
    const period = limitRow?.period ?? "day";
    const key = periodKey(period, tz);
    const limit = limitRow ? (plan.isPro ? limitRow.proLimit : limitRow.freeLimit) : -1;
    if (limit >= 0) {
      const [{ n }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.usageRecords)
        .where(
          and(
            eq(schema.usageRecords.userId, userId),
            eq(schema.usageRecords.feature, feature),
            eq(schema.usageRecords.periodKey, key),
            inArray(schema.usageRecords.status, ["reserved", "consumed"]),
          ),
        );
      if (n >= limit) throw new LimitReachedError(feature, resetLabel(period));
    }
    const [row] = await tx.insert(schema.usageRecords).values({ userId, feature, periodKey: key, status: "reserved", refId }).returning({ id: schema.usageRecords.id });
    return row.id;
  });
}

export async function commitUsage(usageId: string) {
  await db.update(schema.usageRecords).set({ status: "consumed" }).where(eq(schema.usageRecords.id, usageId));
}

export async function refundUsage(usageId: string) {
  await db.update(schema.usageRecords).set({ status: "refunded" }).where(eq(schema.usageRecords.id, usageId));
}

/** Reservations older than 10 minutes were abandoned (e.g. crash) — release them. */
export async function releaseStaleReservations() {
  await db
    .update(schema.usageRecords)
    .set({ status: "refunded" })
    .where(and(eq(schema.usageRecords.status, "reserved"), gt(sql`now() - ${schema.usageRecords.createdAt}`, sql`interval '10 minutes'`)));
}
