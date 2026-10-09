import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { addDays, todayIn } from "@/lib/dates";
import { isOrg, ORGS, ORG_IDS } from "@/lib/orgs";
import { BackHeader, Page } from "@/components/ui/page";
import { Notice } from "@/components/ui/form";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Leaderboards" };

function pseudonym(first: string, last: string, id: string) {
  return `${first[0] ?? "?"}${last[0] ?? ""}·${id.slice(0, 3).toUpperCase()}`;
}

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
      last: schema.profiles.lastName,
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
    .groupBy(schema.xpEvents.userId, schema.profiles.leaderboardVisibility, schema.profiles.displayName, schema.profiles.firstName, schema.profiles.lastName)
    .orderBy(sql`sum(${schema.xpEvents.amount}) desc`)
    .limit(50);
  const optedIn = user.profile!.leaderboardVisibility !== "hidden";
  return (
    <Page>
      <BackHeader href="/" title="Leaderboards" subtitle="Study XP earned in the last 7 days" />
      {!optedIn ? (
        <Notice className="mb-4">
          You&apos;re not on leaderboards. You can join with a nickname or your display name in{" "}
          <Link href="/profile" className="underline">
            Profile → Privacy
          </Link>
          .
        </Notice>
      ) : null}
      <nav aria-label="Scope" className="mb-4 flex flex-wrap gap-2">
        <Link href="/leaderboard" className={cn("rounded-full px-4 py-2 text-sm font-medium", !org ? "bg-fg text-bg" : "bg-subtle")}>
          Global
        </Link>
        {ORG_IDS.map((o) => (
          <Link key={o} href={`/leaderboard?scope=${o}`} className={cn("rounded-full px-4 py-2 text-sm font-medium", org === o ? "bg-fg text-bg" : "bg-subtle")}>
            {ORGS[o].name}
          </Link>
        ))}
        <Link href="/chapter" className="rounded-full bg-subtle px-4 py-2 text-sm font-medium">
          Chapter
        </Link>
      </nav>
      {rows.length ? (
        <ol className="divide-y divide-border rounded-3xl border border-border px-5">
          {rows.map((r, i) => (
            <li key={r.userId} className={cn("flex items-center gap-4 py-3", r.userId === user.id && "font-semibold")}>
              <span className="w-6 text-sm text-muted tabular">{i + 1}</span>
              <span className="flex-1">{r.vis === "name" ? r.display || r.first : pseudonym(r.first, r.last, r.userId)}{r.userId === user.id ? " (you)" : ""}</span>
              <span className="tabular">{r.xp} XP</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-muted">No one on this leaderboard yet this week.</p>
      )}
      <p className="mt-4 text-sm text-muted">Leaderboards measure practice activity, not ability or official results. XP is only earned for activity recorded by PrepX&apos;s servers.</p>
    </Page>
  );
}
