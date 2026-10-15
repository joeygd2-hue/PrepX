import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, gt } from "drizzle-orm";
import { ArrowRight, Check, ChevronRight, Gamepad2, Settings2, Users } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { roster } from "@/server/chapters";
import { Accent, Page, PageTitle, EmptyState } from "@/components/ui/page";
import { OrgBadge, Chip } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, HeroTexture, SectionLabel } from "@/components/ui/card";
import { ListGroup, ListRow } from "@/components/ui/list";
import { Notice } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import type { OrgId } from "@/lib/orgs";
import { CheckInButton, LeaveButton } from "./client";

export const metadata: Metadata = { title: "Chapter" };

export default async function Chapter({ searchParams }: { searchParams: Promise<{ c?: string; joined?: string }> }) {
  const user = await requireUser();
  const { c, joined } = await searchParams;
  const mine = await db
    .select({ chapter: schema.chapters, role: schema.chapterMembers.role, points: schema.chapterMembers.points })
    .from(schema.chapterMembers)
    .innerJoin(schema.chapters, eq(schema.chapters.id, schema.chapterMembers.chapterId))
    .where(eq(schema.chapterMembers.userId, user.id))
    .orderBy(schema.chapters.org);
  if (!mine.length)
    return (
      <Page>
        <PageTitle title={<Accent>Chapter</Accent>} />
        <EmptyState
          icon={<Users />}
          title="No chapter yet"
          body="Join your school's chapter with the code from your advisor or a board member."
          action={
            <ButtonLink href="/join" variant="accent" block size="lg">
              Enter a join code <ArrowRight className="size-5 transition-transform group-hover/btn:translate-x-0.5" aria-hidden />
            </ButtonLink>
          }
        />
        <p className="mt-6 text-center text-sm text-muted">
          Are you an advisor?{" "}
          <Link href="/chapter/new" className="font-medium text-fg underline underline-offset-2">
            Start a chapter for your school
          </Link>
        </p>
      </Page>
    );
  const current = mine.find((m) => m.chapter.id === c) ?? mine[0];
  const ch = current.chapter;
  const lead = current.role !== "member";
  const [open] = await db
    .select()
    .from(schema.checkins)
    .where(and(eq(schema.checkins.chapterId, ch.id), gt(schema.checkins.closesAt, new Date())))
    .orderBy(desc(schema.checkins.opensAt))
    .limit(1);
  const [mineCk] = open ? await db.select().from(schema.checkinRecords).where(and(eq(schema.checkinRecords.checkinId, open.id), eq(schema.checkinRecords.userId, user.id))) : [];
  const news = await db.select().from(schema.chapterAnnouncements).where(eq(schema.chapterAnnouncements.chapterId, ch.id)).orderBy(desc(schema.chapterAnnouncements.createdAt)).limit(10);
  const r = await roster(user.id, ch.id);
  // The roster already ranks only the entries this viewer may see. Show the top 10, plus the viewer's own row if it falls below.
  const board = r.leaderboard.slice(0, 10);
  const me = r.leaderboard.find((e) => e.you);
  const meBelow = me && !board.includes(me) ? me : null;
  const [live] = await db
    .select({ id: schema.quizGames.id, status: schema.quizGames.status })
    .from(schema.quizGames)
    .where(and(eq(schema.quizGames.chapterId, ch.id), gt(schema.quizGames.createdAt, new Date(Date.now() - 6 * 3600_000))))
    .orderBy(desc(schema.quizGames.createdAt))
    .limit(1);
  const gameLive = Boolean(live && live.status !== "ended");

  return (
    <Page>
      <PageTitle
        title={<Accent>Chapter</Accent>}
        right={
          lead ? (
            <ButtonLink href={`/chapter/${ch.id}/manage`} variant="outline" size="sm" className="shrink-0">
              <Settings2 className="size-4" aria-hidden /> Manage
            </ButtonLink>
          ) : null
        }
      />
      {joined ? <Notice tone="success" className="mb-4">You joined {ch.name}. Welcome!</Notice> : null}
      {mine.length > 1 ? (
        <nav aria-label="Your chapters" className="mb-4 flex flex-wrap gap-2">
          {mine.map((m) => (
            <Link
              key={m.chapter.id}
              href={`/chapter?c=${m.chapter.id}`}
              aria-current={m.chapter.id === ch.id}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-full px-4 font-mono text-xs font-semibold tracking-wider transition-colors",
                m.chapter.id === ch.id ? "bg-primary text-primary-fg" : "border border-border bg-card text-muted hover:border-border-strong hover:text-fg",
              )}
            >
              <span className="size-1.5 rounded-full" style={{ background: `var(--${m.chapter.org})` }} aria-hidden />
              {m.chapter.org.toUpperCase()}
            </Link>
          ))}
          {mine.length < 4 ? (
            <Link href="/join" className="inline-flex h-10 items-center rounded-full border border-dashed border-border-strong px-4 text-sm font-medium text-muted transition-colors hover:text-fg">
              + Join another
            </Link>
          ) : null}
        </nav>
      ) : null}

      <div className="stagger space-y-3">
        <Card tone="inverse" className="p-6 shadow-float sm:p-8">
          <HeroTexture />
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2">
              <OrgBadge org={ch.org as OrgId} onHero />
              <Chip tone="inverse">{current.role === "advisor" ? "Advisor" : current.role === "officer" ? "Board member" : "Member"}</Chip>
              {ch.verifiedAt ? <Chip tone="inverse">Verified chapter</Chip> : null}
              {ch.coversPro ? <Chip tone="inverse">Pro covered by chapter</Chip> : null}
            </div>
            <h2 className="mt-8 text-[2rem] font-semibold leading-[1.05] tracking-[-0.035em] [overflow-wrap:anywhere] sm:text-[2.4rem]">{ch.name}</h2>
            <p className="mt-2 text-hero-muted">{ch.school}</p>
            <div className="mt-7 grid grid-cols-2 gap-4 border-t border-hero-line pt-5">
              <p>
                <span className="block font-mono text-[2.25rem] font-medium leading-none tracking-[-0.04em] tabular">{current.points}</span>{" "}
                <span className="mt-1.5 block text-sm text-hero-muted">chapter points</span>
              </p>
              <p>
                <span className="block font-mono text-[2.25rem] font-medium leading-none tracking-[-0.04em] tabular">{r.members.length}</span>{" "}
                <span className="mt-1.5 block text-sm text-hero-muted">member{r.members.length === 1 ? "" : "s"}</span>
              </p>
            </div>

            {open ? (
              <section aria-labelledby="checkin-open" className="mt-6 rounded-[20px] border border-hero-line p-4 sm:p-5">
                <p id="checkin-open" className="eyebrow flex items-center gap-2 !text-hero-muted">
                  <span aria-hidden className="relative inline-flex size-2">
                    <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-60" />
                    <span className="relative size-2 rounded-full bg-accent" />
                  </span>
                  Check-in is open
                </p>
                <p className="mt-3 text-xl font-semibold tracking-[-0.02em]">{open.title}</p>
                <p className="mt-1 font-mono text-xs text-hero-muted tabular">
                  +{open.points} points · closes {open.closesAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </p>
                <div className="mt-4">
                  {mineCk ? (
                    <p className="flex items-center gap-2.5 font-semibold">
                      <span aria-hidden className="pop-in inline-flex size-7 items-center justify-center rounded-full bg-accent text-accent-fg">
                        <Check className="size-4" strokeWidth={3} />
                      </span>
                      You&apos;re checked in!
                    </p>
                  ) : (
                    <CheckInButton id={open.id} />
                  )}
                </div>
              </section>
            ) : null}
          </div>
        </Card>

        <ListGroup>
          <ListRow
            href="/chapter/quiz"
            icon={<Gamepad2 />}
            title="Quiz night"
            subtitle={gameLive ? "A game is live now. Join in!" : lead ? "Host a live quiz for your chapter" : "Join your chapter's live game"}
            right={
              gameLive ? (
                <span className="flex shrink-0 items-center gap-2">
                  <span aria-hidden className="relative inline-flex size-2.5">
                    <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-60" />
                    <span className="relative size-2.5 rounded-full bg-accent shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--fg)_25%,transparent)]" />
                  </span>
                  <ChevronRight className="size-4 text-muted transition-transform duration-200 group-hover/row:translate-x-0.5 group-hover/row:text-fg" aria-hidden />
                </span>
              ) : undefined
            }
          />
        </ListGroup>
      </div>

      <SectionLabel>Announcements</SectionLabel>
      {news.length ? (
        <ul className="stagger space-y-3">
          {news.map((a) => (
            <li key={a.id}>
              <Card>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 text-lg font-semibold tracking-[-0.02em] [overflow-wrap:anywhere]">{a.title}</p>
                  <p className="shrink-0 font-mono text-xs text-muted tabular">{a.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-muted [overflow-wrap:anywhere]">{a.body}</p>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card tone="subtle">
          <p className="text-muted">No announcements yet.</p>
        </Card>
      )}

      <SectionLabel>Leaderboard</SectionLabel>
      {board.length ? (
        <ol className="divide-y divide-border overflow-hidden rounded-[24px] border border-border bg-card px-4 shadow-card sm:px-5">
          {[...board, ...(meBelow ? [meBelow] : [])].map((e, i) => (
            <li key={i} className={cn("flex items-center gap-4 py-3.5", e === meBelow && "border-t border-dashed border-border-strong")}>
              <span className="w-7 shrink-0 font-mono text-sm text-muted tabular">{String(e.rank).padStart(2, "0")}</span>
              <span className={cn("min-w-0 flex-1 truncate", e.you && "font-semibold")}>{e.name}</span>
              {e.you ? <Chip tone="accent">You</Chip> : null}
              <span className="shrink-0 font-mono font-medium tabular">{e.points}</span>
            </li>
          ))}
        </ol>
      ) : (
        <Card tone="subtle">
          <p className="text-muted">No one is on the leaderboard yet.</p>
        </Card>
      )}
      {!r.onLeaderboard ? (
        <p className="mt-3 text-sm text-muted">
          {lead ? "Members don't see your points. " : "You're not on the leaderboard. "}
          <Link href="/profile" className="font-medium text-fg underline underline-offset-2">
            Turn on leaderboards
          </Link>{" "}
          in Profile{lead ? " to show them." : " to join it."}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-muted">
        Points come from meeting check-ins and quiz nights.{lead ? " Members see points only for people who turned on leaderboards." : ""}
      </p>

      <SectionLabel>Members</SectionLabel>
      <ul className="divide-y divide-border overflow-hidden rounded-[24px] border border-border bg-card px-4 shadow-card sm:px-5">
        {r.members.map((m) => (
          <li key={m.userId} className="flex items-center justify-between gap-3 py-3.5">
            <span className="min-w-0 truncate">{m.name}</span>
            {m.role !== "member" ? <Chip className="shrink-0">{m.role === "advisor" ? "Advisor" : "Board"}</Chip> : null}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">Members see display names only. Advisors and board members can see study activity only for members who allow it in Profile.</p>

      <div className="mt-10">
        <LeaveButton chapterId={ch.id} name={ch.name} />
      </div>
    </Page>
  );
}
