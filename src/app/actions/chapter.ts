"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { userOrThrow } from "@/server/auth/session";
import {
  ChapterError,
  checkIn,
  closeCheckin,
  createChapter,
  joinChapter,
  leaveChapter,
  openCheckin,
  postAnnouncement,
  removeMember,
  setMemberRole,
  updateJoinSettings,
} from "@/server/chapters";
import { isOrg } from "@/lib/orgs";

export type FormState = { error?: string; ok?: string } | undefined;
const err = (e: unknown): FormState => {
  if (e instanceof ChapterError) return { error: e.message };
  throw e;
};

export async function joinAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await userOrThrow();
  try {
    await joinChapter(user.id, String(form.get("code") ?? ""));
  } catch (e) {
    return err(e);
  }
  revalidatePath("/", "layout");
  redirect("/chapter?joined=1");
}

export async function createChapterAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await userOrThrow();
  const p = z
    .object({
      org: z.string().refine(isOrg, "Choose an organization."),
      name: z.string().trim().min(3, "Enter the chapter name.").max(80),
      school: z.string().trim().min(2, "Enter the school name.").max(120),
      state: z.string().trim().max(5).optional(),
      regionId: z.string().trim().max(40).optional(),
      confirm: z.literal("on", { message: "Please confirm you're an advisor or authorized chapter officer." }),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  try {
    const c = await createChapter(user.id, { org: p.data.org as "deca", name: p.data.name, school: p.data.school, state: p.data.state || null, regionId: p.data.regionId || null });
    revalidatePath("/", "layout");
    redirect(`/chapter/${c.id}/manage?created=1`);
  } catch (e) {
    return err(e);
  }
}

export async function leaveAction(chapterId: string): Promise<FormState> {
  const user = await userOrThrow();
  try {
    await leaveChapter(user.id, chapterId);
  } catch (e) {
    return err(e);
  }
  revalidatePath("/", "layout");
  redirect("/chapter");
}

export async function roleAction(chapterId: string, userId: string, role: "member" | "officer" | "advisor"): Promise<FormState> {
  const user = await userOrThrow();
  try {
    await setMemberRole(user.id, chapterId, userId, role);
  } catch (e) {
    return err(e);
  }
  revalidatePath(`/chapter/${chapterId}/manage`);
  return { ok: "Role updated." };
}

export async function removeAction(chapterId: string, userId: string): Promise<FormState> {
  const user = await userOrThrow();
  try {
    await removeMember(user.id, chapterId, userId);
  } catch (e) {
    return err(e);
  }
  revalidatePath(`/chapter/${chapterId}/manage`);
  return { ok: "Member removed." };
}

export async function joinSettingsAction(chapterId: string, opts: { regenerate?: boolean; expiresInDays?: number | null; enabled?: boolean }): Promise<FormState> {
  const user = await userOrThrow();
  try {
    await updateJoinSettings(user.id, chapterId, opts);
  } catch (e) {
    return err(e);
  }
  revalidatePath(`/chapter/${chapterId}/manage`);
  return { ok: "Saved." };
}

export async function announceAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await userOrThrow();
  const p = z.object({ chapterId: z.string().uuid(), title: z.string().trim().min(2).max(100), body: z.string().trim().min(2).max(2000) }).safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "Add a title and message." };
  try {
    await postAnnouncement(user.id, p.data.chapterId, p.data.title, p.data.body);
  } catch (e) {
    return err(e);
  }
  revalidatePath("/chapter", "layout");
  return { ok: "Announcement posted." };
}

export async function openCheckinAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await userOrThrow();
  const p = z
    .object({ chapterId: z.string().uuid(), title: z.string().trim().min(2).max(80), minutes: z.coerce.number().int().min(5).max(240), points: z.coerce.number().int().min(1).max(100) })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "Check the title, duration (5–240 min) and points (1–100)." };
  try {
    await openCheckin(user.id, p.data.chapterId, p.data.title, p.data.minutes, p.data.points);
  } catch (e) {
    return err(e);
  }
  revalidatePath("/chapter", "layout");
  return { ok: "Check-in is open." };
}

export async function closeCheckinAction(checkinId: string) {
  const user = await userOrThrow();
  await closeCheckin(user.id, checkinId);
  revalidatePath("/chapter", "layout");
}

export async function checkInAction(checkinId: string): Promise<FormState> {
  const user = await userOrThrow();
  try {
    await checkIn(user.id, checkinId, user.profile!.timezone);
  } catch (e) {
    return err(e);
  }
  revalidatePath("/chapter");
  return { ok: "You're checked in!" };
}
