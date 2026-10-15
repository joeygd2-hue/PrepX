import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { ArrowUpRight, Trophy } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { leaderboardAliases } from "@/server/alias";
import { addDays, todayIn } from "@/lib/dates";
import { isOrg, ORGS, ORG_IDS } from "@/lib/orgs";
import { BackHeader, Page } from "@/components/ui/page";
import { Card, HeroTexture, IconTile } from "@/components/ui/card";
import { Notice } from "@/components/ui/form";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Leaderboards" };

/** One ranked row as rendered. Deliberately carries no user id: only what the page shows. */
type Entry = { rank: number; name: string; xp: number; you: boolean };

const PODIUM_HEIGHT = ["h-28 sm:h-32", "h-20 sm:h-24", "h-14 sm:h-16"];
// First place in the middle, second on the left, third on the right; the DOM keeps rank order for screen readers.
const PODIUM_COLUMN = ["col-start-2", "col-start-1", "col-start-3"];

export default async function Leaderboard({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const user = await requireUser();
  const { scope } = await searchParams;
  const tz = user.profile!.timezone;
  const since = new Date(`${addDays(todayIn(tz), -6)}T00:00:00Z`);
  const org = isOrg(scope) ? scope : null;
  // Only server-recorded study XP counts (not check-ins or referrals), so it reflects practice.
  const orgUsers = org
    ? db.select({ id: schema.eventSelections.userId }).from(schema.eventSelections).where(and(eq(schema.eventSelections.org, org), eq(schema.eventSelections.active, true)))
    : null;
  const rows = await db
    .select({
      userId: schema.xpEvents.userId,
      xp: sql<number>`sum(${schema.xpEvents.amount})::int`,
      vis: schema.profiles.leaderboardVisibility,
      display: schema.profiles.displayName,
      first: schema.profiles.firstName,
    })
    .from(schema.xpEvents)
    .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.xpEvents.userId))
    .where(
      and(
        gte(schema.xpEvents.createdAt, since),
        inArray(schema.xpEvents.reason, ["question", "lesson", "exam", "judge", "flashcards", "explain", "coach", "plan_task", "judge_questions"]),
        ne(schema.profiles.leaderboardVisibility, "hidden"),
        orgUsers ? inArray(schema.xpEvents.userId, orgUsers) : undefined,
      ),
    )
    .groupBy(schema.xpEvents.userId, schema.profiles.leaderboardVisibility, schema.profiles.displayName, schema.profiles.firstName)
    .orderBy(sql`sum(${schema.xpEvents.amount}) desc`)
    .limit(50);
  // Nickname rows show a random alias that isn't derived from the student's name or id.
  const aliases = await leaderboardAliases(rows.filter((r) => r.vis === "pseudonym").map((r) => r.userId));
  const entries: Entry[] = rows.map((r, i) => ({
    rank: i + 1,
    name: r.vis === "name" ? r.display || r.first : (aliases.get(r.userId) ?? "Anonymous"),
    xp: r.xp,
    you: r.userId === user.id,
  }));
  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);
  const optedIn = user.profile!.leaderboardVisibility !== "hidden";
  return (
    <Page>
      <BackHeader href="/" title="Leaderboards" subtitle="Study XP earned in the last 7 days" />
      {!optedIn ? (
        <Notice className="mb-4">
          You&apos;re not on leaderboards. You can join with a nickname or your display name in{" "}
          <Link href="/profile" className="font-medium underline underline-offset-4">
            Profile → Privacy
          </Link>
          .
        </Notice>
      ) : null}
      <nav aria-label="Scope" className="mb-5 flex flex-col gap-2 sm:flex-row">
        <div className="grid flex-1 grid-cols-5 gap-1 rounded-[16px] border border-border bg-subtle/80 p-1">
          <ScopeLink href="/leaderboard" active={!org}>
            Global
          </ScopeLink>
          {ORG_IDS.map((o) => (
            <ScopeLink key={o} href={`/leaderboard?scope=${o}`} active={org === o}>
              <span className="size-1.5 shrink-0 rounded-full" style={{ background: `var(--${o})` }} aria-hidden />
              {ORGS[o].name}
            </ScopeLink>
          ))}
        </div>
        <Link
          href="/chapter"
          className="inline-flex h-12 items-center justify-center gap-1.5 rounded-[16px] border border-border bg-card px-4 text-sm font-medium shadow-card transition-colors hover:border-border-strong"
        >
          Chapter <ArrowUpRight className="size-3.5 text-muted" aria-hidden />
        </Link>
      </nav>
      {entries.length ? (
        <>
          <Card tone="inverse" className="px-4 pb-0 pt-6 shadow-float sm:px-6 sm:pb-0 sm:pt-8">
            <HeroTexture />
            <ol className="relative grid grid-cols-3 items-end gap-2 sm:gap-3">
              {podium.map((e, i) => (
                <li key={e.rank} className={cn("row-start-1 flex min-w-0 flex-col items-center text-center", PODIUM_COLUMN[i])}>
                  <span className={cn("block w-full break-words text-sm font-semibold leading-tight tracking-[-0.01em] sm:text-[15px]", e.you && "text-accent")}>
                    {e.name}
                    {e.you ? " (you)" : ""}
                  </span>
                  <span className="mt-1 font-mono text-xs text-hero-muted tabular">{e.xp} XP</span>
                  <span
                    aria-hidden
                    className={cn(
                      "mt-3 flex w-full items-start justify-center rounded-t-[16px] pt-3 font-mono text-2xl font-medium tracking-[-0.04em] tabular sm:text-3xl",
                      PODIUM_HEIGHT[i],
                      e.you ? "bg-accent text-accent-fg" : "bg-hero-line text-hero-fg",
                    )}
                  >
                    {e.rank}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
          {rest.length ? (
            <ol start={4} className="mt-3 divide-y divide-border overflow-hidden rounded-[24px] border border-border bg-card px-4 shadow-card sm:px-5">
              {rest.map((e) => (
                <li key={e.rank} className={cn("flex items-center gap-4 py-3.5", e.you && "-mx-4 bg-accent/15 px-4 font-semibold sm:-mx-5 sm:px-5")}>
                  <span className="w-7 shrink-0 font-mono text-sm text-muted tabular">{e.rank}</span>
                  <span className="min-w-0 flex-1 break-words">
                    {e.name}
                    {e.you ? " (you)" : ""}
                  </span>
                  <span className="shrink-0 font-mono text-sm tabular">{e.xp} XP</span>
                </li>
              ))}
            </ol>
          ) : null}
        </>
      ) : (
        <Card tone="subtle" className="flex items-center gap-4">
          <IconTile inverse>
            <Trophy />
          </IconTile>
          <p className="text-muted">No one on this leaderboard yet this week.</p>
        </Card>
      )}
      <p className="mt-5 px-1 text-sm text-muted">Leaderboards measure practice activity, not ability or official results. XP is only earned for activity recorded by PrepX&apos;s servers.</p>
    </Page>
  );
}

function ScopeLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-[12px] font-mono text-[11px] font-semibold tracking-wider transition-colors sm:text-xs",
        active ? "bg-card text-fg shadow-card" : "text-muted hover:text-fg",
      )}
    >
      {children}
    </Link>
  );
}
