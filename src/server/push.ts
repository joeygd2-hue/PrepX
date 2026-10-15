import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { env, features } from "@/lib/env";

type Sub = typeof schema.pushSubscriptions.$inferSelect;

/** Sends Web Push via VAPID when configured; silently does nothing otherwise. Expired endpoints are removed. */
export async function sendPush(subs: Sub[], payload: { title: string; body: string; url: string }) {
  if (!features.push() || !subs.length) return;
  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(`mailto:${env.supportEmail}`, env.push.vapidPublic, env.push.vapidPrivate);
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600 });
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.id, s.id));
      }
    }),
  );
}
