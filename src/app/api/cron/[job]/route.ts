import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { JOBS } from "@/server/jobs";

/**
 * Scheduled jobs. Call with `Authorization: Bearer $CRON_SECRET`:
 *   hourly: streak-reminders, weekly-recaps · daily: competition-reminders, parent-monthly, cleanup
 */
export async function GET(req: Request, { params }: { params: Promise<{ job: string }> }) {
  const auth = req.headers.get("authorization") ?? "";
  if (!env.cronSecret || !safeEqual(auth, `Bearer ${env.cronSecret}`)) return new Response("Unauthorized", { status: 401 });
  const { job } = await params;
  const fn = JOBS[job as keyof typeof JOBS];
  if (!fn) return new Response("Unknown job", { status: 404 });
  const result = await fn();
  return Response.json({ job, ...result });
}
export const POST = GET;
