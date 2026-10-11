"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { userOrThrow } from "@/server/auth/session";
import { createDuel, declineDuel, DuelError, joinDuel, startDuel } from "@/server/duels";

export type DuelFormState = { error?: string } | undefined;

const CreateInput = z.object({ exam: z.string().trim().min(1).max(64), opponent: z.union([z.literal(""), z.uuid()]).default("") });
const CodeInput = z.object({ code: z.string().trim().min(1).max(32) });
const IdInput = z.object({ id: z.uuid() });

const field = (form: FormData, name: string) => (typeof form.get(name) === "string" ? String(form.get(name)) : undefined);

/** Every server-side rule (buddies only, bank size, rate limits, ownership) lives in @/server/duels. */
async function run<T>(fn: () => Promise<T>): Promise<{ ok: T } | { error: string }> {
  try {
    return { ok: await fn() };
  } catch (e) {
    if (e instanceof DuelError) return { error: e.message };
    throw e;
  }
}

export async function createDuelAction(_: DuelFormState, form: FormData): Promise<DuelFormState> {
  const user = await userOrThrow();
  const p = CreateInput.safeParse({ exam: field(form, "exam"), opponent: field(form, "opponent") ?? "" });
  if (!p.success) return { error: "Choose a friend or an invite code." };
  const r = await run(() => createDuel({ userId: user.id, clusterId: p.data.exam, opponentId: p.data.opponent || null }));
  if ("error" in r) return r;
  revalidatePath("/study/duels");
  redirect(`/study/duels/${r.ok.id}`);
}

export async function joinDuelAction(_: DuelFormState, form: FormData): Promise<DuelFormState> {
  const user = await userOrThrow();
  const p = CodeInput.safeParse({ code: field(form, "code") });
  if (!p.success) return { error: "Enter the 6-character duel code." };
  const r = await run(() => joinDuel(user.id, p.data.code));
  if ("error" in r) return r;
  revalidatePath("/study/duels");
  redirect(`/study/duels/${r.ok}`);
}

export async function startDuelAction(_: DuelFormState, form: FormData): Promise<DuelFormState> {
  const user = await userOrThrow();
  const p = IdInput.safeParse({ id: field(form, "id") });
  if (!p.success) return { error: "Duel not found." };
  const r = await run(() => startDuel({ userId: user.id, tz: user.profile!.timezone, duelId: p.data.id }));
  if ("error" in r) return r;
  revalidatePath("/study/duels");
  redirect(`/study/attempt/${r.ok}`);
}

export async function declineDuelAction(_: DuelFormState, form: FormData): Promise<DuelFormState> {
  const user = await userOrThrow();
  const p = IdInput.safeParse({ id: field(form, "id") });
  if (!p.success) return { error: "Duel not found." };
  const r = await run(() => declineDuel(user.id, p.data.id));
  if ("error" in r) return r;
  revalidatePath("/study/duels");
  redirect(`/study/duels?exam=${encodeURIComponent(r.ok.clusterId)}`);
}
