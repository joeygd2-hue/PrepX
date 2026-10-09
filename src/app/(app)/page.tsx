import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { AlertCircle, Bell, CalendarDays, Flag, Gamepad2, Gift, KeyRound, MessageSquare, Mic, School, Share2, Smile, Trophy } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { homeAnnouncements, studyContext, unreadNotifications } from "@/server/dashboard";
import { xpSummary } from "@/server/progress";
import { todayIn, formatDay } from "@/lib/dates";
import { Page } from "@/components/ui/page";
import { ListGroup, ListRow } from "@/components/ui/list";
import { SectionLabel, IconTile } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Avatar, initials } from "@/components/app/avatar";
import { CountdownHero } from "@/components/app/countdown-hero";
import { TodayPlan } from "@/components/app/today-plan";
import { LevelCard } from "@/components/app/level-card";
import { InstallCard } from "@/components/app/install-card";

export default async function Home() {
  const user = await requireUser();
  const p = user.profile!;
  const tz = p.timezone;
  const today = todayIn(tz);
  const [ctx, xp, announcements, unread, memberships] = await Promise.all([
    studyContext(user.id, tz, p.dailyStudyMinutes),
    xpSummary(user.id, tz),
    homeAnnouncements(user.id, p.orgInterests),
    unreadNotifications(user.id),
    db.select({ org: schema.chapterMembers.org }).from(schema.chapterMembers).where(eq(schema.chapterMembers.userId, user.id)),
  ]);
  const regionPref = ctx
    ? (await db.select().from(schema.orgPreferences).where(and(eq(schema.orgPreferences.userId, user.id), eq(schema.orgPreferences.org, ctx.event.org))))[0]
    : undefined;

  return (
    <Page>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{formatDay(today)}</p>
          <h1 className="mt-1 text-[2rem] font-semibold leading-tight tracking-tight">Hi, {p.displayName || p.firstName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/notifications" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} className="relative inline-flex size-12 items-center justify-center rounded-full hover:bg-subtle">
            <Bell className="size-5" aria-hidden />
            {unread ? <span className="absolute right-2 top-2 size-2.5 rounded-full bg-danger" aria-hidden /> : null}
          </Link>
          <Link href="/profile" aria-label="Profile">
            <Avatar text={initials(p.firstName, p.lastName)} />
          </Link>
        </div>
      </header>

      <div className="space-y-4">
        <InstallCard />

        {announcements.map((a) => (
          <Link key={a.id} href={`/announcements/${a.id}`} className="flex items-center gap-3 rounded-3xl border border-border p-5 hover:bg-subtle/60">
            <AlertCircle className="size-5 shrink-0" aria-hidden />
            <span className="font-medium">
              {a.title}. <span className="text-muted">Tap to see.</span>
            </span>
          </Link>
        ))}

        {ctx?.target && ctx.daysLeft !== null ? (
          <CountdownHero target={ctx.target} daysLeft={ctx.daysLeft} />
        ) : !ctx ? (
          <section className="rounded-3xl bg-fg p-6 text-bg">
            <p className="text-sm opacity-70">Start here</p>
            <h2 className="mt-2 text-2xl font-semibold">Choose your event</h2>
            <p className="mt-2 opacity-80">Pick the event you&apos;re competing in to get a countdown, a smart study plan and practice tools made for it.</p>
            <ButtonLink href="/study/events" variant="subtle" className="mt-5 bg-bg text-fg">
              Browse events
            </ButtonLink>
          </section>
        ) : (
          <section className="rounded-3xl border border-border p-6">
            <h2 className="text-xl font-semibold">No competition date yet</h2>
            <p className="mt-2 text-muted">We don&apos;t have a confirmed date for your next {ctx.event.org.toUpperCase()} competition. Add your own target date to get a countdown and plan.</p>
            <ButtonLink href="/study/target" variant="outline" className="mt-4">
              Set a target date
            </ButtonLink>
          </section>
        )}

        {ctx && !regionPref?.regionId && ctx.target?.kind !== "custom" ? (
          <ListGroup>
            <ListRow href="/calendar/region" icon={<CalendarDays />} title="Add your district or area" subtitle="Choose your district or area to get official dates." />
          </ListGroup>
        ) : null}

        {memberships.length === 0 ? (
          <section className="rounded-3xl bg-subtle p-6">
            <IconTile inverse>
              <KeyRound />
            </IconTile>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight">Join your chapter</h2>
            <p className="mt-2 text-muted">Ask your advisor or a board member for your chapter&apos;s 6-character join code.</p>
            <ButtonLink href="/join" block className="mt-5">
              → Enter a join code
            </ButtonLink>
          </section>
        ) : null}

        {ctx ? <TodayPlan headline={ctx.tasks.headline} tasks={ctx.tasks.tasks} /> : null}

        {ctx ? (
          <ListGroup>
            <ListRow
              href="/study"
              icon={<Mic />}
              title={`Practice ${ctx.event.code}`}
              subtitle="AI coach, practice tests and judge for your event"
              className="[&>span:first-child]:bg-fg [&>span:first-child]:text-bg"
            />
          </ListGroup>
        ) : null}

        <LevelCard level={xp.level} total={xp.total} week={xp.week} />
      </div>

      <SectionLabel>Stay motivated</SectionLabel>
      <ListGroup>
        <ListRow href="/buddies" icon={<Smile />} title="Study buddies" subtitle="See each other's streaks · send a nudge" />
        <ListRow href="/goals" icon={<Flag />} title="Season goals" subtitle="Set a target · get a weekly pace" />
        <ListRow href="/chapter/quiz" icon={<Gamepad2 />} title="Quiz night" subtitle="Join your chapter's live game" />
        <ListRow href="/invite" icon={<Gift />} title="Invite friends" subtitle="Earn XP and badges when friends practice" />
        <ListRow href="/share" icon={<Share2 />} title="Share your wins" subtitle="Story cards for streaks and personal bests" />
        <ListRow href="/leaderboard" icon={<Trophy />} title="Leaderboards" subtitle="Opt-in rankings by study activity" />
      </ListGroup>

      <SectionLabel>More</SectionLabel>
      <ListGroup>
        <ListRow href="/profile/feedback" icon={<MessageSquare />} title="Send feedback" subtitle="Report a bug or share an idea" />
        <ListRow href="/chapter/new" icon={<School />} title="I'm an advisor" subtitle="Start a chapter for your school" />
      </ListGroup>
    </Page>
  );
}
