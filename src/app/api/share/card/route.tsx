import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { eq, desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/server/auth/session";
import { streakSummary, xpSummary } from "@/server/progress";

// The app's own typefaces (Geist and Geist Mono, SIL Open Font License), read once per server.
const [geist, geistMono] = await Promise.all([
  readFile(join(process.cwd(), "src/app/api/share/card/geist-semibold.ttf")),
  readFile(join(process.cwd(), "src/app/api/share/card/geist-mono-medium.ttf")),
]);

// "Graphite & Volt" palette, matching the app's tokens.
const GRAPHITE = "#0c0c0d";
const PAPER = "#f4f4ef";
const VOLT = "#c6f03a";
const MUTED = "rgba(244, 244, 239, 0.62)";
const LINE = "rgba(244, 244, 239, 0.14)";
const CONTENT_WIDTH = 1080 - 2 * 96;

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.profile?.onboardingCompletedAt) return new Response("Unauthorized", { status: 401 });
  const type = req.nextUrl.searchParams.get("type") ?? "streak";
  const showName = req.nextUrl.searchParams.get("name") === "1";
  const tz = user.profile.timezone;
  let big = "";
  let line = "";
  let label = "";
  if (type === "level") {
    const xp = await xpSummary(user.id, tz);
    big = `Lv ${xp.level.level}`;
    line = `${xp.level.name} · ${xp.total.toLocaleString()} XP`;
    label = "LEVEL";
  } else if (type === "sprint") {
    const [best] = await db.select().from(schema.sprintBests).where(eq(schema.sprintBests.userId, user.id)).orderBy(desc(schema.sprintBests.best)).limit(1);
    big = String(best?.best ?? 0);
    line = "correct in a 60-second sprint";
    label = "SPRINT BEST";
  } else {
    const s = await streakSummary(user.id, tz);
    big = String(s.current);
    line = `day study streak${s.longest > s.current ? ` · best ${s.longest}` : ""}`;
    label = "STUDY STREAK";
  }
  // Mono glyphs are 0.6em wide; shrink long values so they stay on one line.
  const bigSize = Math.min(360, Math.floor(CONTENT_WIDTH / (Math.max(big.length, 1) * 0.6)));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative", background: GRAPHITE, color: PAPER, padding: 96, fontFamily: "Geist" }}>
        <div style={{ position: "absolute", top: -360, right: -360, width: 1000, height: 1000, display: "flex", backgroundImage: "radial-gradient(circle, rgba(198, 240, 58, 0.3) 0%, rgba(198, 240, 58, 0) 62%)" }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <svg width="88" height="88" viewBox="0 0 32 32">
              <rect x="0.5" y="0.5" width="31" height="31" rx="9.5" fill="#18181b" stroke={LINE} />
              <path d="M10 10 L14 14 M18 18 L22 22" stroke={PAPER} strokeWidth="3" strokeLinecap="round" />
              <path d="M10 22 L22 10" stroke={PAPER} strokeWidth="3" strokeLinecap="round" />
              <path d="M16.2 10 H22 V15.8" fill="none" stroke={VOLT} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div style={{ display: "flex", fontSize: 60, letterSpacing: -2.4 }}>PrepX</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontFamily: "Geist Mono", fontSize: 28, letterSpacing: 4, color: MUTED }}>
            <div style={{ display: "flex", width: 14, height: 14, borderRadius: 7, background: VOLT }} />
            <div style={{ display: "flex" }}>{label}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {showName ? <div style={{ display: "flex", fontSize: 56, color: MUTED, marginBottom: 24 }}>{user.profile.firstName}</div> : null}
          <div style={{ display: "flex", fontFamily: "Geist Mono", fontSize: bigSize, lineHeight: 0.9, letterSpacing: -0.06 * bigSize }}>{big}</div>
          <div style={{ display: "flex", width: 160, height: 14, borderRadius: 7, background: VOLT, marginTop: 56 }} />
          <div style={{ display: "flex", fontSize: 64, lineHeight: 1.15, letterSpacing: -1.6, marginTop: 48 }}>{line}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", height: 2, background: LINE }} />
          <div style={{ display: "flex", marginTop: 40, fontFamily: "Geist Mono", fontSize: 30, letterSpacing: 3, color: MUTED }}>DECA · FBLA · HOSA · TSA PREP</div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      fonts: [
        { name: "Geist", data: geist, weight: 600, style: "normal" },
        { name: "Geist Mono", data: geistMono, weight: 500, style: "normal" },
      ],
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
