import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Trophy } from "lucide-react";
import { db, schema } from "@/db";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { levelFor } from "@/lib/levels";
import { PublicPage } from "@/components/shell/public-page";
import { sql } from "drizzle-orm";

export const metadata: Metadata = { title: "Trophy case", robots: { index: false } };

/** Public trophy page: badges and level only. Name hidden unless the student opts in. */
export default async function Trophies({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9]{10}$/.test(id)) notFound();
  const [p] = await db.select().from(schema.profiles).where(eq(schema.profiles.publicTrophyId, id));
  if (!p) notFound();
  const earned = await db.select().from(schema.userAchievements).where(eq(schema.userAchievements.userId, p.userId));
  const [{ xp }] = await db.select({ xp: sql<number>`coalesce(sum(${schema.xpEvents.amount}),0)::int` }).from(schema.xpEvents).where(eq(schema.xpEvents.userId, p.userId));
  const lvl = levelFor(xp);
  const have = new Set(earned.map((e) => e.achievementId));
  return (
    <PublicPage>
      <p className="eyebrow">Trophy case</p>
      <h1 className="mt-1 text-4xl font-bold tracking-tight">{p.hideNameOnTrophies ? "A PrepX competitor" : p.displayName || p.firstName}</h1>
      <p className="mt-2 text-muted">
        Level {lvl.level} · {lvl.name}
      </p>
      <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ACHIEVEMENTS.filter((a) => have.has(a.id)).map((a) => (
          <li key={a.id} className="flex flex-col items-center rounded-3xl bg-subtle p-5 text-center">
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-fg text-bg" aria-hidden>
              <Trophy className="size-5" />
            </span>
            <span className="mt-3 font-medium">{a.label}</span>
            <span className="text-xs text-muted">{a.description}</span>
          </li>
        ))}
      </ul>
      {!have.size ? <p className="mt-6 text-muted">No badges yet. They&apos;re on their way!</p> : null}
    </PublicPage>
  );
}
