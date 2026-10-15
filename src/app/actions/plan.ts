"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { userOrThrow } from "@/server/auth/session";

/** Manual tick for self-tracking. Awards no XP; XP comes only from server-recorded activity. */
export async function toggleTask(taskId: string) {
  const user = await userOrThrow();
  const [t] = await db.select().from(schema.planTasks).where(and(eq(schema.planTasks.id, taskId), eq(schema.planTasks.userId, user.id)));
  if (!t) return;
  await db.update(schema.planTasks).set({ completedAt: t.completedAt ? null : new Date() }).where(eq(schema.planTasks.id, t.id));
  revalidatePath("/");
  revalidatePath("/study");
}

export async function dismissAnnouncement(id: string) {
  const user = await userOrThrow();
  await db.insert(schema.announcementDismissals).values({ userId: user.id, announcementId: id }).onConflictDoNothing();
  revalidatePath("/");
}
