"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { userOrThrow } from "@/server/auth/session";
import { rateLimit } from "@/server/ratelimit";
import { recordActivity } from "@/server/progress";
import { MINUTE_OPTIONS, REMINDER_TIME_RE, WEEKDAYS, normalizeStudyDays, typicalMinutes, type StudyDays } from "@/lib/planner";

export type PlannerResult = { ok: true; message: string } | { ok: false; error: string };

const Minutes = z.number().int().refine((n) => n === 0 || (MINUTE_OPTIONS as readonly number[]).includes(n));
const PlannerInput = z.object({
  /** Minutes for mon..sun in order; 0 = rest day. */
  days: z.array(Minutes).length(WEEKDAYS.length),
  reminderTime: z.string().regex(REMINDER_TIME_RE).nullable(),
});

/** Saves the student's study week and reminder time. The typical study day becomes the daily study time. */
export async function savePlanner(raw: { days: number[]; reminderTime: string | null }): Promise<PlannerResult> {
  const user = await userOrThrow();
  const input = PlannerInput.safeParse(raw);
  if (!input.success) return { ok: false, error: input.error.issues.some((i) => i.path[0] === "reminderTime") ? "Pick a reminder time." : "Pick 15, 20, 30, 45 or 60 minutes for each study day." };
  const week: StudyDays = Object.fromEntries(WEEKDAYS.map((d, i) => [d, input.data.days[i]]));
  const typical = typicalMinutes(week);
  if (typical === null) return { ok: false, error: "Pick at least one study day." };
  if (!(await rateLimit(`planner:${user.id}`, 30, 300))) return { ok: false, error: "You're saving very quickly. Wait a moment and try again." };
  await db
    .update(schema.profiles)
    .set({ studyDays: normalizeStudyDays(week), studyReminderTime: input.data.reminderTime, dailyStudyMinutes: typical, updatedAt: new Date() })
    .where(eq(schema.profiles.userId, user.id));
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved. We'll fit your practice around this week." };
}

const FOCUS_LENGTHS = [15, 25, 45] as const;

/**
 * Called when a focus session runs to the end: counts today as a study day for the streak.
 * One completion per 14 minutes (the shortest session is 15), so it can't be spammed.
 */
export async function completeFocusSession(minutes: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await userOrThrow();
  const parsed = z
    .number()
    .int()
    .refine((n) => (FOCUS_LENGTHS as readonly number[]).includes(n))
    .safeParse(minutes);
  if (!parsed.success) return { ok: false, error: "Unknown session length." };
  if (!(await rateLimit(`focus:${user.id}`, 1, 14 * 60))) return { ok: false, error: "This session was already counted." };
  await recordActivity(user.id, user.profile!.timezone);
  revalidatePath("/", "layout");
  return { ok: true };
}
