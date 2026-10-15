"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { todayIn } from "@/lib/dates";
import { z } from "zod";
import { db, schema } from "@/db";
import { userOrThrow } from "@/server/auth/session";
import { isOrg } from "@/lib/orgs";

/** Switches the event for that organization. Old selection is kept (inactive) so history isn't lost. */
export async function selectEvent(eventId: string) {
  const user = await userOrThrow();
  const [event] = await db.select().from(schema.events).where(and(eq(schema.events.id, eventId), eq(schema.events.active, true)));
  if (!event) throw new Error("Event not found");
  await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(schema.eventSelections)
      .where(and(eq(schema.eventSelections.userId, user.id), eq(schema.eventSelections.org, event.org), eq(schema.eventSelections.active, true)));
    if (current?.eventId === event.id) return;
    if (current) await tx.update(schema.eventSelections).set({ active: false, endedAt: new Date() }).where(eq(schema.eventSelections.id, current.id));
    await tx.insert(schema.eventSelections).values({
      userId: user.id,
      eventId: event.id,
      org: event.org,
      // Carry over the chosen date/competition: it belongs to the season, not the event.
      competitionId: current?.competitionId ?? null,
      targetDate: current?.targetDate ?? null,
    });
    await tx.update(schema.profiles).set({ focusOrg: event.org }).where(eq(schema.profiles.userId, user.id));
    await tx.insert(schema.orgPreferences).values({ userId: user.id, org: event.org, showDates: true }).onConflictDoUpdate({
      target: [schema.orgPreferences.userId, schema.orgPreferences.org],
      set: { showDates: true },
    });
  });
  revalidatePath("/", "layout");
  redirect("/study");
}

export async function setFocusOrg(org: string) {
  const user = await userOrThrow();
  if (!isOrg(org)) return;
  await db.update(schema.profiles).set({ focusOrg: org }).where(eq(schema.profiles.userId, user.id));
  revalidatePath("/", "layout");
}

export type TargetState = { error?: string } | undefined;

export async function setTarget(_: TargetState, form: FormData): Promise<TargetState> {
  const user = await userOrThrow();
  const org = String(form.get("org"));
  if (!isOrg(org)) return { error: "Choose an organization." };
  const mode = String(form.get("mode"));
  const [sel] = await db
    .select()
    .from(schema.eventSelections)
    .where(and(eq(schema.eventSelections.userId, user.id), eq(schema.eventSelections.org, org), eq(schema.eventSelections.active, true)));
  if (!sel) return { error: "Choose an event first." };
  if (mode === "custom") {
    const d = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(form.get("date"));
    if (!d.success) return { error: "Enter a date." };
    await db.update(schema.eventSelections).set({ targetDate: d.data, competitionId: null }).where(eq(schema.eventSelections.id, sel.id));
  } else if (mode === "competition") {
    const id = String(form.get("competitionId") ?? "");
    const [comp] = await db.select().from(schema.competitions).where(and(eq(schema.competitions.id, id), eq(schema.competitions.org, org)));
    if (!comp) return { error: "Choose a competition." };
    await db.update(schema.eventSelections).set({ competitionId: comp.id, targetDate: null }).where(eq(schema.eventSelections.id, sel.id));
  } else {
    await db.update(schema.eventSelections).set({ competitionId: null, targetDate: null }).where(eq(schema.eventSelections.id, sel.id));
  }
  // Regenerate today's unfinished tasks against the new date (completed history is kept).
  await db
    .delete(schema.planTasks)
    .where(
      and(
        eq(schema.planTasks.userId, user.id),
        eq(schema.planTasks.eventId, sel.eventId),
        eq(schema.planTasks.day, todayIn(user.profile?.timezone ?? "America/Chicago")),
        isNull(schema.planTasks.completedAt),
      ),
    );
  revalidatePath("/", "layout");
  redirect("/study");
}
