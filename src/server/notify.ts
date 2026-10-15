import "server-only";
import { and, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { sendPush } from "./push";

type PrefKey = "chapterAnnouncements" | "checkinOpen" | "streakReminder" | "competitionCountdown";

/**
 * In-app notification (always, for the bell) plus a web push when the user enabled that
 * category and granted push permission on a device.
 */
export async function notifyUsers(userIds: string[], pref: PrefKey, n: { kind: string; title: string; body: string; href: string; dedupeKey: string }) {
  if (!userIds.length) return;
  const prefs = await db.select().from(schema.notificationPrefs).where(inArray(schema.notificationPrefs.userId, userIds));
  const allowed = new Set(prefs.filter((p) => p[pref]).map((p) => p.userId));
  const targets = userIds.filter((u) => allowed.has(u) || !prefs.some((p) => p.userId === u));
  if (!targets.length) return;
  await db
    .insert(schema.notifications)
    .values(targets.map((userId) => ({ userId, ...n })))
    .onConflictDoNothing();
  const subs = await db.select().from(schema.pushSubscriptions).where(and(inArray(schema.pushSubscriptions.userId, targets)));
  await sendPush(subs, { title: n.title, body: n.body, url: n.href });
}
