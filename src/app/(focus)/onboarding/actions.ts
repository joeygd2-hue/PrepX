"use server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { getCurrentUser, destroySession } from "@/server/auth/session";
import { ageOn, MIN_AGE, TERMS_VERSION } from "@/lib/age";
import { todayIn } from "@/lib/dates";
import { ORG_IDS } from "@/lib/orgs";
import { deleteAccount } from "@/server/account";

export type StepState = { error?: string } | undefined;
const STEPS = ["name", "age", "school", "orgs", "terms"] as const;

async function me() {
  const u = await getCurrentUser();
  if (!u) redirect("/sign-in");
  return u;
}
const next = (step: (typeof STEPS)[number]) => STEPS[STEPS.indexOf(step) + 1] ?? "done";

export async function saveName(_: StepState, form: FormData): Promise<StepState> {
  const u = await me();
  const p = z
    .object({
      firstName: z.string().trim().min(1, "Enter your first name.").max(50),
      lastName: z.string().trim().min(1, "Enter your last name.").max(50),
      displayName: z.string().trim().max(40).optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  await db
    .update(schema.profiles)
    .set({ ...p.data, displayName: p.data.displayName || p.data.firstName, onboardingStep: next("name"), updatedAt: new Date() })
    .where(eq(schema.profiles.userId, u.id));
  redirect("/onboarding");
}

export async function saveAge(_: StepState, form: FormData): Promise<StepState> {
  const u = await me();
  const birth = String(form.get("birthDate") ?? "");
  const tz = String(form.get("timezone") ?? "America/Chicago").slice(0, 64);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) return { error: "Enter your date of birth." };
  const age = ageOn(birth, todayIn("UTC"));
  if (age > 100 || age < 0) return { error: "Check the date and try again." };
  if (age < MIN_AGE) {
    // Do not retain data for under-13 users: delete the account immediately.
    await deleteAccount(u.id, "under_13");
    await destroySession();
    redirect("/sign-in/too-young");
  }
  const validTz = Intl.supportedValuesOf("timeZone").includes(tz) ? tz : "America/Chicago";
  await db.update(schema.profiles).set({ birthDate: birth, timezone: validTz, onboardingStep: next("age"), updatedAt: new Date() }).where(eq(schema.profiles.userId, u.id));
  redirect("/onboarding");
}

export async function saveSchool(_: StepState, form: FormData): Promise<StepState> {
  const u = await me();
  const p = z
    .object({
      grade: z.coerce.number().int().min(6).max(13),
      school: z.string().trim().max(120).optional(),
      state: z.string().trim().max(5).optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "Choose your grade." };
  await db
    .update(schema.profiles)
    .set({ grade: p.data.grade, school: p.data.school || null, onboardingStep: next("school"), updatedAt: new Date() })
    .where(eq(schema.profiles.userId, u.id));
  if (p.data.state) {
    for (const org of ORG_IDS)
      await db.insert(schema.orgPreferences).values({ userId: u.id, org, state: p.data.state, showDates: false }).onConflictDoUpdate({
        target: [schema.orgPreferences.userId, schema.orgPreferences.org],
        set: { state: p.data.state },
      });
  }
  redirect("/onboarding");
}

export async function saveOrgs(_: StepState, form: FormData): Promise<StepState> {
  const u = await me();
  const orgs = form.getAll("org").map(String).filter((o) => (ORG_IDS as string[]).includes(o));
  if (!orgs.length) return { error: "Pick at least one organization. You can change this later." };
  await db.update(schema.profiles).set({ orgInterests: orgs, onboardingStep: next("orgs"), updatedAt: new Date() }).where(eq(schema.profiles.userId, u.id));
  for (const org of ORG_IDS) {
    await db
      .insert(schema.orgPreferences)
      .values({ userId: u.id, org, showDates: orgs.includes(org) })
      .onConflictDoUpdate({ target: [schema.orgPreferences.userId, schema.orgPreferences.org], set: { showDates: orgs.includes(org) } });
  }
  redirect("/onboarding");
}

export async function acceptTerms(_: StepState, form: FormData): Promise<StepState> {
  const u = await me();
  if (form.get("terms") !== "on") return { error: "Please agree to the Terms and Privacy Policy to continue." };
  const [p] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, u.id));
  if (!p?.firstName || !p.birthDate || !p.grade || !p.orgInterests.length) {
    // Resumable: send the user back to whatever is missing.
    const missing = !p?.firstName ? "name" : !p.birthDate ? "age" : !p.grade ? "school" : "orgs";
    await db.update(schema.profiles).set({ onboardingStep: missing }).where(eq(schema.profiles.userId, u.id));
    redirect("/onboarding");
  }
  await db
    .update(schema.profiles)
    .set({ termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION, onboardingStep: "done", onboardingCompletedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.profiles.userId, u.id));
  redirect("/study/events");
}

export async function goToStep(step: string) {
  const u = await me();
  if (!(STEPS as readonly string[]).includes(step)) return;
  await db.update(schema.profiles).set({ onboardingStep: step }).where(eq(schema.profiles.userId, u.id));
  redirect("/onboarding");
}
