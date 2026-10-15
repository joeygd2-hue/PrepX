import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { Flame, Trophy } from "lucide-react";
import { db, schema } from "@/db";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { levelFor } from "@/lib/levels";
import { PublicPage } from "@/components/shell/public-page";
import { Card, HeroTexture } from "@/components/ui/card";
import { Accent } from "@/components/ui/page";

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
  const badges = ACHIEVEMENTS.filter((a) => have.has(a.id));
  return (
    <PublicPage>
      <Card tone="inverse" className="rounded-[28px] p-6 shadow-float sm:p-10">
        <HeroTexture />
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <p className="eyebrow !text-hero-muted">Trophy case</p>
            <p className="font-mono text-xs text-hero-muted tabular">
              {badges.length} {badges.length === 1 ? "badge" : "badges"}
            </p>
          </div>
          <h1 className="mt-12 break-words text-[2.75rem] font-semibold leading-[1.02] tracking-[-0.045em] sm:mt-16 sm:text-7xl">
            {p.hideNameOnTrophies ? (
              <>
                A PrepX <Accent>competitor</Accent>
              </>
            ) : (
              <Accent>{p.displayName || p.firstName}</Accent>
            )}
          </h1>
          <div className="mt-6 flex items-center gap-3">
            <span aria-hidden className="inline-flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-accent font-mono text-lg font-semibold text-accent-fg tabular">
              {lvl.level}
            </span>
            <p className="text-hero-muted">
              Level {lvl.level} · <span className="font-medium text-hero-fg">{lvl.name}</span>
            </p>
          </div>
          {badges.length ? (
            <ul className="stagger mt-10 grid grid-cols-2 gap-2.5 border-t border-hero-line pt-8 sm:grid-cols-3">
              {badges.map((a) => {
                const Icon = a.group === "streak" ? Flame : Trophy;
                return (
                  <li key={a.id} className="rounded-[16px] border border-hero-line p-4">
                    <span aria-hidden className="inline-flex size-10 items-center justify-center rounded-full bg-accent text-accent-fg">
                      <Icon className="size-[18px]" />
                    </span>
                    <p className="mt-4 font-semibold leading-snug tracking-[-0.01em]">{a.label}</p>
                    <p className="mt-1 text-[13px] leading-snug text-hero-muted">{a.description}</p>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {!have.size ? <p className="mt-10 border-t border-hero-line pt-6 text-hero-muted">No badges yet. They&apos;re on their way!</p> : null}
        </div>
      </Card>
    </PublicPage>
  );
}
