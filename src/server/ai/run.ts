import "server-only";
import { commitUsage, refundUsage, reserveUsage, type Feature } from "@/server/entitlements";
import { db, schema } from "@/db";

/**
 * Charges one unit of `feature` only if `fn` succeeds. Any failure (AI down, timeout,
 * refusal, validation) refunds the reservation so students never pay for nothing.
 */
export async function withUsage<T>(userId: string, feature: Feature, tz: string, fn: () => Promise<T>): Promise<T> {
  const usageId = await reserveUsage(userId, feature, tz);
  try {
    const out = await fn();
    await commitUsage(usageId);
    return out;
  } catch (e) {
    await refundUsage(usageId);
    await db.insert(schema.errorLog).values({ scope: `ai:${feature}`, message: (e as Error).message?.slice(0, 500) ?? "unknown" }).catch(() => undefined);
    throw e;
  }
}
