"use server";
import { revalidatePath } from "next/cache";
import { and, eq, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { userOrThrow } from "@/server/auth/session";
import { rateLimit } from "@/server/ratelimit";
import { notifyUsers } from "@/server/notify";

export type FormState = { error?: string; ok?: string } | undefined;

export async function addBuddy(_: FormState, form: FormData): Promise<FormState> {
  const user = await userOrThrow();
  const code = String(form.get("code") ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{6,12}$/.test(code)) return { error: "Friend codes are 8 letters and numbers." };
  if (!(await rateLimit(`buddy:${user.id}`, 20, 86400))) return { error: "Too many requests today." };
  const [target] = await db.select({ userId: schema.profiles.userId }).from(schema.profiles).where(eq(schema.profiles.referralCode, code));
  if (!target || target.userId === user.id) return { error: "We couldn't find that friend code." };
  const [existing] = await db
    .select()
    .from(schema.buddies)
    .where(
      or(
        and(eq(schema.buddies.requesterId, user.id), eq(schema.buddies.addresseeId, target.userId)),
        and(eq(schema.buddies.requesterId, target.userId), eq(schema.buddies.addresseeId, user.id)),
      ),
    );
  if (existing) {
    if (existing.status === "pending" && existing.addresseeId === user.id) {
      await db.update(schema.buddies).set({ status: "accepted" }).where(eq(schema.buddies.id, existing.id));
      revalidatePath("/buddies");
      return { ok: "You're now study buddies!" };
    }
    return { ok: existing.status === "accepted" ? "You're already buddies." : "Request already sent." };
  }
  await db.insert(schema.buddies).values({ requesterId: user.id, addresseeId: target.userId });
  await notifyUsers([target.userId], "streakReminder", { kind: "buddy_request", title: `${user.profile!.displayName} wants to be study buddies`, body: "Accept to see each other's streaks.", href: "/buddies", dedupeKey: `buddy:${user.id}` });
  revalidatePath("/buddies");
  return { ok: "Request sent. They'll see it on their Buddies page." };
}

export async function respondBuddy(id: string, accept: boolean) {
  const user = await userOrThrow();
  if (accept) await db.update(schema.buddies).set({ status: "accepted" }).where(and(eq(schema.buddies.id, id), eq(schema.buddies.addresseeId, user.id)));
  else await db.delete(schema.buddies).where(and(eq(schema.buddies.id, id), or(eq(schema.buddies.addresseeId, user.id), eq(schema.buddies.requesterId, user.id))));
  revalidatePath("/buddies");
}

/** One nudge per buddy pair per day. */
export async function nudgeBuddy(id: string): Promise<FormState> {
  const user = await userOrThrow();
  const [b] = await db
    .select()
    .from(schema.buddies)
    .where(and(eq(schema.buddies.id, id), eq(schema.buddies.status, "accepted"), or(eq(schema.buddies.requesterId, user.id), eq(schema.buddies.addresseeId, user.id))));
  if (!b) return { error: "Buddy not found." };
  if (b.lastNudgeAt && Date.now() - b.lastNudgeAt.getTime() < 20 * 3600_000) return { error: "You already nudged today." };
  const other = b.requesterId === user.id ? b.addresseeId : b.requesterId;
  await db.update(schema.buddies).set({ lastNudgeAt: new Date() }).where(eq(schema.buddies.id, b.id));
  await notifyUsers([other], "streakReminder", { kind: "nudge", title: `${user.profile!.displayName} nudged you`, body: "A few minutes of practice keeps your streak alive.", href: "/study", dedupeKey: `nudge:${b.id}:${new Date().toISOString().slice(0, 10)}` });
  return { ok: "Nudge sent!" };
}

export async function saveGoals(_: FormState, form: FormData): Promise<FormState> {
  const user = await userOrThrow();
  const p = z
    .object({ eventId: z.string(), targetReadiness: z.coerce.number().int().min(50).max(100), weeklyQuestions: z.coerce.number().int().min(0).max(2000), weeklyJudgeRuns: z.coerce.number().int().min(0).max(50) })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "Check your goal values." };
  await db
    .insert(schema.seasonGoals)
    .values({ userId: user.id, ...p.data })
    .onConflictDoUpdate({ target: [schema.seasonGoals.userId, schema.seasonGoals.eventId], set: { ...p.data, updatedAt: sql`now()` } });
  revalidatePath("/goals");
  return { ok: "Goals saved." };
}
