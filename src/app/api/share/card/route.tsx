import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/server/auth/session";
import { streakSummary, xpSummary } from "@/server/progress";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.profile?.onboardingCompletedAt) return new Response("Unauthorized", { status: 401 });
  const type = req.nextUrl.searchParams.get("type") ?? "streak";
  const showName = req.nextUrl.searchParams.get("name") === "1";
  const tz = user.profile.timezone;
  let big = "";
  let line = "";
  if (type === "level") {
    const xp = await xpSummary(user.id, tz);
    big = `Lv ${xp.level.level}`;
    line = `${xp.level.name} · ${xp.total.toLocaleString()} XP`;
  } else if (type === "sprint") {
    const [best] = await db.select().from(schema.sprintBests).where(eq(schema.sprintBests.userId, user.id)).orderBy(desc(schema.sprintBests.best)).limit(1);
    big = String(best?.best ?? 0);
    line = "correct in a 60-second sprint";
  } else {
    const s = await streakSummary(user.id, tz);
    big = String(s.current);
    line = `day study streak${s.longest > s.current ? ` · best ${s.longest}` : ""}`;
  }
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0a0a0a", color: "#fff", padding: 96, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", fontSize: 48, fontWeight: 700 }}>PrepX</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {showName ? <div style={{ fontSize: 56, opacity: 0.7 }}>{user.profile.firstName}</div> : null}
          <div style={{ fontSize: 360, fontWeight: 700, lineHeight: 1 }}>{big}</div>
          <div style={{ fontSize: 64, opacity: 0.85, marginTop: 24 }}>{line}</div>
        </div>
        <div style={{ display: "flex", fontSize: 36, opacity: 0.6 }}>DECA · FBLA · HOSA · TSA prep</div>
      </div>
    ),
    { width: 1080, height: 1920, headers: { "Cache-Control": "private, no-store" } },
  );
}
