import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { calendarItems } from "@/server/calendar";
import { buildIcs } from "@/lib/ics";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.profile?.onboardingCompletedAt) return new Response("Unauthorized", { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  const item = (await calendarItems(user.id, user.profile.timezone)).find((i) => i.id === id);
  if (!item) return new Response("Not found", { status: 404 });
  const ics = buildIcs([{ uid: item.id, title: item.title, start: item.start, end: item.end, description: item.note ?? undefined, location: item.location ?? undefined, url: item.sourceUrl ?? undefined }], item.title);
  const name = item.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 60);
  return new Response(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.ics"`, "Cache-Control": "no-store" } });
}
