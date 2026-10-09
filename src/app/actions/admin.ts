"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireRole } from "@/server/auth/session";
import { notifyUsers } from "@/server/notify";
import { generateQuestions } from "@/server/ai/tasks";
import { AiFailedError, AiNotConfiguredError } from "@/server/ai/provider";

export type FormState = { error?: string; ok?: string } | undefined;
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function audit(actorId: string, action: string, target: string, meta: Record<string, unknown> = {}) {
  await db.insert(schema.auditLog).values({ actorId, action, target, meta });
}

export async function saveCompetition(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireRole(["staff", "admin"]);
  const p = z
    .object({
      id: z.string().regex(/^[a-z0-9-]{3,60}$/, "ID: lowercase letters, numbers and dashes."),
      isNew: z.string().optional(),
      org: z.enum(["deca", "fbla", "hosa", "tsa"]),
      level: z.enum(["international", "national", "state", "district", "regional"]),
      name: z.string().trim().min(3).max(120),
      shortName: z.string().trim().min(2).max(60),
      state: z.string().trim().max(5).optional(),
      regionId: z.string().trim().max(40).optional(),
      startsOn: ymd,
      endsOn: ymd,
      timezone: z.string().refine((t) => Intl.supportedValuesOf("timeZone").includes(t), "Unknown time zone."),
      location: z.string().trim().max(120).optional(),
      status: z.enum(["confirmed", "tentative", "unconfirmed"]),
      statusNote: z.string().trim().max(500).optional(),
      sourceUrl: z.union([z.string().url(), z.literal("")]).optional(),
      sourceCheckedAt: z.union([ymd, z.literal("")]).optional(),
      announce: z.string().optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  if (d.endsOn < d.startsOn) return { error: "End date is before start date." };
  const row = {
    org: d.org,
    level: d.level,
    name: d.name,
    shortName: d.shortName,
    state: d.state || null,
    regionId: d.regionId || null,
    startsOn: d.startsOn,
    endsOn: d.endsOn,
    timezone: d.timezone,
    location: d.location || null,
    status: d.status,
    statusNote: d.statusNote || null,
    sourceUrl: d.sourceUrl || null,
    sourceCheckedAt: d.sourceCheckedAt || null,
    updatedAt: new Date(),
  };
  const [existing] = await db.select().from(schema.competitions).where(eq(schema.competitions.id, d.id));
  if (d.isNew && existing) return { error: "That ID already exists." };
  const changed = existing && (existing.startsOn !== d.startsOn || existing.endsOn !== d.endsOn);
  if (existing) {
    await db
      .update(schema.competitions)
      .set({ ...row, ...(changed ? { previousStartsOn: existing.startsOn, dateChangedAt: new Date() } : {}) })
      .where(eq(schema.competitions.id, d.id));
  } else {
    await db.insert(schema.competitions).values({ id: d.id, ...row });
  }
  await audit(admin.id, existing ? "competition.update" : "competition.create", d.id, { changed, startsOn: d.startsOn });
  if (changed && d.announce === "on") {
    await db.insert(schema.announcements).values({
      org: d.org,
      competitionId: d.id,
      kind: "date_change",
      title: `${d.name} has a new date`,
      body: `${d.name} is now scheduled for ${d.startsOn}${d.endsOn !== d.startsOn ? ` to ${d.endsOn}` : ""}${d.location ? ` in ${d.location}` : ""}. Countdowns and study plans have been updated automatically.`,
      sourceUrl: d.sourceUrl || null,
      createdBy: admin.id,
    });
    const affected = await db
      .selectDistinct({ userId: schema.eventSelections.userId })
      .from(schema.eventSelections)
      .where(and(eq(schema.eventSelections.org, d.org), eq(schema.eventSelections.active, true)));
    await notifyUsers(
      affected.map((a) => a.userId),
      "competitionCountdown",
      { kind: "date_change", title: `${d.shortName} has a new date`, body: `Now ${d.startsOn}. Your plan has been updated.`, href: "/", dedupeKey: `datechange:${d.id}:${d.startsOn}` },
    );
  }
  revalidatePath("/", "layout");
  redirect("/admin/competitions");
}

export async function deleteCompetition(id: string) {
  const admin = await requireRole(["admin"]);
  await db.delete(schema.competitions).where(eq(schema.competitions.id, id));
  await audit(admin.id, "competition.delete", id);
  revalidatePath("/admin/competitions");
}

export async function saveAnnouncement(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireRole(["staff", "admin"]);
  const p = z
    .object({
      org: z.enum(["", "deca", "fbla", "hosa", "tsa"]),
      title: z.string().trim().min(3).max(140),
      body: z.string().trim().min(3).max(4000),
      sourceUrl: z.union([z.string().url(), z.literal("")]),
      expiresAt: z.union([ymd, z.literal("")]),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const [a] = await db
    .insert(schema.announcements)
    .values({ org: p.data.org || null, title: p.data.title, body: p.data.body, sourceUrl: p.data.sourceUrl || null, expiresAt: p.data.expiresAt ? new Date(p.data.expiresAt) : null, createdBy: admin.id })
    .returning();
  await audit(admin.id, "announcement.create", a.id);
  revalidatePath("/admin/announcements");
  return { ok: "Published." };
}

export async function deleteAnnouncement(id: string) {
  const admin = await requireRole(["staff", "admin"]);
  await db.delete(schema.announcements).where(eq(schema.announcements.id, id));
  await audit(admin.id, "announcement.delete", id);
  revalidatePath("/admin/announcements");
}

export async function saveEvent(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireRole(["staff", "admin"]);
  const p = z
    .object({
      id: z.string(),
      name: z.string().trim().min(2).max(140),
      formatLabel: z.string().trim().min(2).max(120),
      verification: z.enum(["verified", "reference_observed", "unverified"]),
      rubricVerification: z.enum(["verified", "reference_observed", "unverified"]),
      sourceUrl: z.union([z.string().url(), z.literal("")]),
      sourceCheckedAt: z.union([ymd, z.literal("")]),
      active: z.string().optional(),
      components: z.string(),
      rubric: z.string(),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  let components: unknown, rubric: unknown;
  try {
    components = JSON.parse(p.data.components);
    rubric = JSON.parse(p.data.rubric);
  } catch {
    return { error: "Components and rubric must be valid JSON." };
  }
  const Rubric = z.array(z.object({ id: z.string().min(1), label: z.string().min(1), description: z.string() }));
  const Components = z.object({}).passthrough();
  if (!Rubric.safeParse(rubric).success || !Components.safeParse(components).success) return { error: "Rubric must be a list of {id, label, description}; components must be an object." };
  await db
    .update(schema.events)
    .set({
      name: p.data.name,
      formatLabel: p.data.formatLabel,
      verification: p.data.verification,
      rubricVerification: p.data.rubricVerification,
      sourceUrl: p.data.sourceUrl || null,
      sourceCheckedAt: p.data.sourceCheckedAt || null,
      active: p.data.active === "on",
      components: components as schema.EventComponentsT,
      rubric: rubric as schema.RubricCriterionT[],
      updatedAt: new Date(),
    })
    .where(eq(schema.events.id, p.data.id));
  await audit(admin.id, "event.update", p.data.id, { verification: p.data.verification });
  revalidatePath("/admin/events");
  return { ok: "Saved." };
}

export async function saveLimit(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireRole(["admin"]);
  const p = z
    .object({ feature: z.string(), freeLimit: z.coerce.number().int().min(-1).max(100000), proLimit: z.coerce.number().int().min(-1).max(100000), period: z.enum(["day", "month", "season", "lifetime"]) })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "Limits must be whole numbers (-1 for unlimited)." };
  await db.update(schema.planLimits).set({ freeLimit: p.data.freeLimit, proLimit: p.data.proLimit, period: p.data.period, updatedAt: new Date() }).where(eq(schema.planLimits.feature, p.data.feature));
  await audit(admin.id, "limit.update", p.data.feature, p.data);
  revalidatePath("/admin/limits");
  return { ok: "Saved." };
}

export async function setChapterFlags(chapterId: string, flags: { verified?: boolean; coversPro?: boolean }) {
  const admin = await requireRole(["staff", "admin"]);
  await db
    .update(schema.chapters)
    .set({ ...(flags.verified !== undefined ? { verifiedAt: flags.verified ? new Date() : null } : {}), ...(flags.coversPro !== undefined ? { coversPro: flags.coversPro } : {}) })
    .where(eq(schema.chapters.id, chapterId));
  await audit(admin.id, "chapter.flags", chapterId, flags);
  revalidatePath("/admin/chapters");
}

export async function setFeedbackStatus(id: string, status: "open" | "resolved") {
  const admin = await requireRole(["staff", "admin"]);
  await db.update(schema.feedback).set({ status }).where(eq(schema.feedback.id, id));
  await audit(admin.id, "feedback.status", id, { status });
  revalidatePath("/admin/feedback");
}

export async function setUserRole(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireRole(["admin"]);
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const role = String(form.get("role"));
  if (!["student", "staff", "admin"].includes(role)) return { error: "Invalid role." };
  const [u] = await db.select().from(schema.users).where(sql`lower(${schema.users.email}) = ${email}`);
  if (!u) return { error: "No user with that email." };
  if (u.id === admin.id && role !== "admin") return { error: "You can't remove your own admin role." };
  await db.update(schema.users).set({ role: role as "student" }).where(eq(schema.users.id, u.id));
  await audit(admin.id, "user.role", u.id, { role });
  return { ok: `Role set to ${role}.` };
}

export async function aiGenerateQuestions(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireRole(["staff", "admin"]);
  const unitId = String(form.get("unitId"));
  const count = Math.min(10, Math.max(1, Number(form.get("count") ?? 5)));
  const [unit] = await db.select().from(schema.units).where(eq(schema.units.id, unitId));
  if (!unit) return { error: "Unit not found." };
  const [cluster] = await db.select().from(schema.examClusters).where(eq(schema.examClusters.id, unit.clusterId));
  try {
    const out = await generateQuestions(cluster.name, unit.title, count);
    await db.insert(schema.questions).values(
      out.questions.map((q) => ({ clusterId: unit.clusterId, unitId, stem: q.stem, choices: q.choices, answerIndex: q.answerIndex, explanation: q.explanation, source: "ai_generated" as const, status: "review", createdBy: admin.id })),
    );
    await audit(admin.id, "questions.generate", unitId, { count: out.questions.length });
  } catch (e) {
    if (e instanceof AiFailedError || e instanceof AiNotConfiguredError) return { error: e.message };
    throw e;
  }
  revalidatePath("/admin/questions");
  return { ok: "Generated. Review each question before publishing." };
}

export async function setQuestionStatus(id: string, status: "published" | "retired" | "review") {
  const admin = await requireRole(["staff", "admin"]);
  await db.update(schema.questions).set({ status }).where(eq(schema.questions.id, id));
  await audit(admin.id, "question.status", id, { status });
  revalidatePath("/admin/questions");
}
