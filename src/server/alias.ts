import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { randomAlias } from "@/lib/alias";

/**
 * Leaderboard nicknames for the given users. Anyone without one gets a random alias,
 * stored so it stays the same across visits. Safe under concurrent requests.
 */
export async function leaderboardAliases(userIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = [...new Set(userIds)];
  if (!ids.length) return out;
  const rows = await db
    .select({ userId: schema.profiles.userId, alias: schema.profiles.leaderboardAlias })
    .from(schema.profiles)
    .where(inArray(schema.profiles.userId, ids));
  for (const r of rows) {
    if (r.alias) {
      out.set(r.userId, r.alias);
      continue;
    }
    const [set] = await db
      .update(schema.profiles)
      .set({ leaderboardAlias: randomAlias() })
      .where(and(eq(schema.profiles.userId, r.userId), isNull(schema.profiles.leaderboardAlias)))
      .returning({ alias: schema.profiles.leaderboardAlias });
    if (set?.alias) {
      out.set(r.userId, set.alias);
      continue;
    }
    // Another request assigned one first.
    const [again] = await db.select({ alias: schema.profiles.leaderboardAlias }).from(schema.profiles).where(eq(schema.profiles.userId, r.userId));
    if (again?.alias) out.set(r.userId, again.alias);
  }
  return out;
}
