import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { ArrowRight, ArrowUpRight, Bell, CalendarDays, Flag, Flame, Gamepad2, Gift, KeyRound, MessageSquare, Mic, School, Share2, Smile, Trophy } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { homeAnnouncements, studyContext, unreadNotifications } from "@/server/dashboard";
import { streakSummary, xpSummary } from "@/server/progress";
import { todayIn, formatDay, greetingFor } from "@/lib/dates";
import { Accent, Page } from "@/components/ui/page";
import { ListGroup, ListRow } from "@/components/ui/list";
import { Card, HeroTexture, SectionLabel, IconTile } from "@/components/ui/card";
import { Tile, TileGrid } from "@/components/ui/tile";
import { ButtonLink } from "@/components/ui/button";
import { Avatar, initials } from "@/components/app/avatar";
import { CountdownHero } from "@/components/app/countdown-hero";
import { TodayPlan } from "@/components/app/today-plan";
import { LevelCard } from "@/components/app/level-card";
import { InstallCard } from "@/components/app/install-card";
import { LaunchBanner } from "@/components/app/launch-banner";
import { getPlanStatus } from "@/server/entitlements";
import { minutesForToday } from "@/lib/planner";

export default async function Home() {
  const user = await requireUser();
  const p = user.profile!;
  const tz = p.timezone;
  const today = todayIn(tz);
  const goalMinutes = minutesForToday(p, tz);
  const [ctx, xp, streak, announcements, unread, memberships, plan] = await Promise.all([
    studyContext(user.id, tz, Math.max(10, goalMinutes)),
    xpSummary(user.id, tz),
    streakSummary(user.id, tz),
    homeAnnouncements(user.id, p.orgInterests),
    unreadNotifications(user.id),
    db.select({ org: schema.chapterMembers.org }).from(schema.chapterMembers).where(eq(schema.chapterMembers.userId, user.id)),
    getPlanStatus(user.id),
  ]);
  const regionPref = ctx
    ? (await db.select().from(schema.orgPreferences).where(and(eq(schema.orgPreferences.userId, user.id), eq(schema.orgPreferences.org, ctx.event.org))))[0]
    : undefined;

  const name = p.displayName || p.firstName;

  return (
    <Page>
      <header className="mb-7 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">{formatDay(today)}</p>
          <h1 className="mt-2 text-[2.15rem] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[2.6rem]">
            {greetingFor(tz)}, <Accent>{name}</Accent>
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/notifications"
            aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
            className="relative inline-flex size-11 items-center justify-center rounded-[14px] border border-border bg-card shadow-card transition-colors hover:border-border-strong"
          >
            <Bell className="size-[18px]" aria-hidden />
            {unread ? <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-accent ring-2 ring-card shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--fg)_25%,transparent)]" aria-hidden /> : null}
          </Link>
          <Link href="/profile" aria-label="Profile" className="rounded-full transition-transform hover:scale-[1.04]">
            <Avatar text={initials(p.firstName, p.lastName)} />
          </Link>
        </div>
      </header>

      <div className="stagger space-y-3">
        {plan.source === "launch" && plan.detail ? <LaunchBanner endsOn={plan.detail} /> : null}
        <InstallCard />

        {announcements.map((a) => (
          <Link
            key={a.id}
            href={`/announcements/${a.id}`}
            className="group/ann flex items-center gap-3 rounded-[18px] border border-border bg-card px-4 py-3.5 shadow-card transition-colors hover:border-border-strong"
          >
            <span aria-hidden className="relative inline-flex size-2.5 shrink-0">
              <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative size-2.5 rounded-full bg-accent shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--fg)_25%,transparent)]" />
            </span>
            <span className="min-w-0 flex-1 text-[15px] font-medium tracking-[-0.01em]">
              {a.title}. <span className="font-normal text-muted">Tap to see.</span>
            </span>
            <ArrowUpRight className="size-4 shrink-0 text-muted transition-transform group-hover/ann:-translate-y-0.5 group-hover/ann:translate-x-0.5" aria-hidden />
          </Link>
        ))}

        {ctx?.target && ctx.daysLeft !== null ? (
          <CountdownHero target={ctx.target} daysLeft={ctx.daysLeft} />
        ) : !ctx ? (
          <Card tone="inverse" className="p-6 shadow-float sm:p-8">
            <HeroTexture />
            <div className="relative">
              <p className="eyebrow !text-hero-muted">Start here</p>
              <h2 className="mt-6 text-[2rem] font-semibold leading-[1.05] tracking-[-0.035em]">
                Choose your <Accent>event</Accent>
              </h2>
              <p className="mt-3 max-w-md text-hero-muted">Pick the event you&apos;re competing in to get a countdown, a smart study plan and practice tools made for it.</p>
              <ButtonLink href="/study/events" variant="accent" className="mt-6">
                Browse events <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-0.5" aria-hidden />
              </ButtonLink>
            </div>
          </Card>
        ) : (
          <Card>
            <p className="eyebrow">Countdown</p>
            <h2 className="mt-3 text-xl font-semibold tracking-[-0.02em]">No competition date yet</h2>
            <p className="mt-2 text-muted">We don&apos;t have a confirmed date for your next {ctx.event.org.toUpperCase()} competition. Add your own target date to get a countdown and plan.</p>
            <ButtonLink href="/study/target" variant="outline" className="mt-5">
              Set a target date
            </ButtonLink>
          </Card>
        )}

        {ctx && !regionPref?.regionId && ctx.target?.kind !== "custom" ? (
          <ListGroup>
            <ListRow href="/calendar/region" icon={<CalendarDays />} title="Add your district or area" subtitle="Choose your district or area to get official dates." />
          </ListGroup>
        ) : null}

        {memberships.length === 0 ? (
          <Card tone="subtle" className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <IconTile inverse>
              <KeyRound />
            </IconTile>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold tracking-[-0.02em]">Join your chapter</h2>
              <p className="mt-1 text-sm text-muted">Ask your advisor or a board member for your chapter&apos;s 6-character join code.</p>
            </div>
            <ButtonLink href="/join" className="shrink-0">
              Enter a join code <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-0.5" aria-hidden />
            </ButtonLink>
          </Card>
        ) : null}

        {ctx ? <TodayPlan headline={ctx.tasks.headline} tasks={ctx.tasks.tasks} goalMinutes={goalMinutes} /> : null}

        <TileGrid>
          {ctx ? (
            <Tile href="/study" tone="accent" icon={<Mic />} title={`Practice ${ctx.event.code}`} subtitle="AI coach, practice tests and judge for your event" />
          ) : (
            <Tile href="/study/events" tone="accent" icon={<Mic />} title="Start practicing" subtitle="Choose an event to unlock practice tools" />
          )}
          <Tile
            href="/profile"
            icon={<Flame />}
            title={
              <>
                <span className="font-mono text-[1.6rem] font-medium tracking-[-0.04em] tabular">{streak.current}</span> day streak
              </>
            }
            subtitle={streak.practicedToday ? "You practiced today. Nice." : streak.current ? "Practice today to keep it going" : "Practice today to start one"}
          />
        </TileGrid>

        <LevelCard level={xp.level} total={xp.total} week={xp.week} />
      </div>

      <SectionLabel>Stay motivated</SectionLabel>
      <TileGrid cols={3}>
        <Tile href="/buddies" icon={<Smile />} title="Study buddies" subtitle="See streaks · send a nudge" />
        <Tile href="/goals" icon={<Flag />} title="Season goals" subtitle="Set a target · get a weekly pace" />
        <Tile href="/chapter/quiz" icon={<Gamepad2 />} title="Quiz night" subtitle="Your chapter's live game" />
        <Tile href="/invite" icon={<Gift />} title="Invite friends" subtitle="Earn XP and badges" />
        <Tile href="/share" icon={<Share2 />} title="Share your wins" subtitle="Story cards for streaks and bests" />
        <Tile href="/leaderboard" icon={<Trophy />} title="Leaderboards" subtitle="Opt-in rankings by study activity" />
      </TileGrid>

      <SectionLabel>More</SectionLabel>
      <ListGroup>
        <ListRow href="/profile/feedback" icon={<MessageSquare />} title="Send feedback" subtitle="Report a bug or share an idea" />
        <ListRow href="/chapter/new" icon={<School />} title="I'm an advisor" subtitle="Start a chapter for your school" />
      </ListGroup>
    </Page>
  );
}
