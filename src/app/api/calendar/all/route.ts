import { getCurrentUser } from "@/server/auth/session";
import { calendarItems } from "@/server/calendar";
import { buildIcs } from "@/lib/ics";

/** Downloads the signed-in user's calendar. Nothing is written to any external calendar. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user?.profile?.onboardingCompletedAt) return new Response("Unauthorized", { status: 401 });
  const items = await calendarItems(user.id, user.profile.timezone);
  const ics = buildIcs(
    items.map((i) => ({ uid: i.id, title: i.title, start: i.start, end: i.end, description: [i.note, i.status !== "confirmed" ? `Date status: ${i.status}` : null].filter(Boolean).join("\n"), location: i.location ?? undefined, url: i.sourceUrl ?? undefined })),
    "PrepX competitions",
  );
  return new Response(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="prepx-calendar.ics"', "Cache-Control": "no-store" } });
}
