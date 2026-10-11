import "server-only";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { env } from "@/lib/env";

/**
 * Finds or creates a user by verified email; links Google subject when provided. New profiles start
 * with empty names: names are saved by onboarding, after the age check.
 */
export async function upsertVerifiedUser(email: string, googleSub?: string) {
  const normalized = email.trim().toLowerCase();
  const existing = await db.select().from(schema.users).where(sql`lower(${schema.users.email}) = ${normalized}`).limit(1);
  const role = env.adminEmails.includes(normalized) ? "admin" : undefined;
  if (existing[0]) {
    const u = existing[0];
    await db
      .update(schema.users)
      .set({
        emailVerifiedAt: u.emailVerifiedAt ?? new Date(),
        googleSub: u.googleSub ?? googleSub ?? null,
        lastSeenAt: new Date(),
        ...(role ? { role } : {}),
      })
      .where(eq(schema.users.id, u.id));
    return { id: u.id, isNew: false };
  }
  const [u] = await db
    .insert(schema.users)
    .values({ email: normalized, emailVerifiedAt: new Date(), googleSub: googleSub ?? null, role: role ?? "student" })
    .returning({ id: schema.users.id });
  await db.insert(schema.profiles).values({ userId: u.id, firstName: "", lastName: "" }).onConflictDoNothing();
  await db.insert(schema.notificationPrefs).values({ userId: u.id }).onConflictDoNothing();
  return { id: u.id, isNew: true };
}
