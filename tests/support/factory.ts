import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

let n = 0;
export async function makeUser(opts: { role?: "student" | "staff" | "admin"; org?: "deca" | "fbla" | "hosa" | "tsa"; first?: string; tz?: string } = {}) {
  n++;
  const email = `t${Date.now()}_${n}_${Math.random().toString(36).slice(2, 7)}@prepx.test`;
  const [u] = await db.insert(schema.users).values({ email, emailVerifiedAt: new Date(), role: opts.role ?? "student" }).returning();
  await db.insert(schema.profiles).values({
    userId: u.id,
    firstName: opts.first ?? "Test",
    lastName: "Student",
    displayName: opts.first ?? "Test",
    birthDate: "2010-01-01",
    grade: 10,
    orgInterests: [opts.org ?? "deca"],
    onboardingStep: "done",
    onboardingCompletedAt: new Date(),
    termsAcceptedAt: new Date(),
    timezone: opts.tz ?? "America/Chicago",
    focusOrg: opts.org ?? "deca",
  });
  await db.insert(schema.notificationPrefs).values({ userId: u.id });
  return u;
}

export async function selectEvent(userId: string, eventId: string) {
  const [e] = await db.select().from(schema.events).where(eq(schema.events.id, eventId));
  await db.insert(schema.eventSelections).values({ userId, eventId, org: e.org });
  return e;
}
