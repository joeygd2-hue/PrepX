"use server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { sha256 } from "@/lib/crypto";
import { rateLimit } from "@/server/ratelimit";
import { clientIp } from "@/server/request";

/** Called by the parent (no account) from the emailed link. */
export async function confirmFamily(token: string) {
  if (!(await rateLimit(`family-confirm:${await clientIp()}`, 20, 3600))) return;
  await db
    .update(schema.familyLinks)
    .set({ status: "confirmed", confirmedAt: new Date() })
    .where(and(eq(schema.familyLinks.tokenHash, sha256(token)), eq(schema.familyLinks.status, "pending")));
}

export async function stopFamily(token: string) {
  if (!(await rateLimit(`family-stop:${await clientIp()}`, 20, 3600))) return false;
  const deleted = await db.delete(schema.familyLinks).where(eq(schema.familyLinks.tokenHash, sha256(token))).returning();
  return deleted.length > 0;
}
