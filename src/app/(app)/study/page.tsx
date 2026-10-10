import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, sql } from "drizzle-orm";
import { ArrowRight, BookOpen, Check, FileText, Flame, Gauge, Globe, History, Layers, MessageCircle, MessagesSquare, Mic, Presentation, Repeat, Timer, User, Zap, Layers3 } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { studyContext } from "@/server/dashboard";
import { examStats, openMistakes, streakSummary, xpSummary } from "@/server/progress";
import { getAllowance, getPlanStatus } from "@/server/entitlements";
import { readiness } from "@/lib/plan";
import { ORGS, type OrgId } from "@/lib/orgs";
import { Accent, Page, PageTitle } from "@/components/ui/page";
import { ListGroup, ListRow } from "@/components/ui/list";
import { Card, HeroTexture, SectionLabel } from "@/components/ui/card";
import { StatStrip, Tile, TileGrid } from "@/components/ui/tile";
import { Chip, OrgBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/form";
import { OrgSwitcher } from "@/components/app/org-switcher";
import { EventSummary } from "@/components/app/event-details";
import { PlanCard } from "@/components/app/plan-card";
import { ReadinessCard } from "@/components/app/readiness-card";
import { TodayPlan } from "@/components/app/today-plan";
import { LevelCard } from "@/components/app/level-card";
import { features } from "@/lib/env";

export const metadata: Metadata = { title: "Study" };

export default async function Study() {
  const user = await requireUser();
  const p = user.profile!;
  const tz = p.timezone;
  const org = (p.focusOrg ?? p.orgInterests[0] ?? "deca") as OrgId;
  const ctx = await studyContext(user.id, tz, p.dailyStudyMinutes, org);
  const xp = await xpSummary(user.id, tz);

  return (
    <Page>
      <PageTitle eyebrow="Study" title={<>Your <Accent>event</Accent></>} />
      <OrgSwitcher value={org} />
      {!ctx ? (
        <Card tone="inverse" className="mt-5 p-6 shadow-float sm:p-8">
          <HeroTexture />
          <div className="relative">
            <OrgBadge org={org} onHero />
            <h2 className="mt-6 text-[1.75rem] font-semibold leading-[1.1] tracking-[-0.03em]">Choose your {ORGS[org].name} event</h2>
            <p className="mt-3 max-w-md text-hero-muted">Pick an event to unlock a countdown, a smart study plan and practice tools built around it.</p>
            <ButtonLink href={`/study/events?federation=${org}`} variant="accent" className="mt-6">
              Browse {ORGS[org].name} events <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-0.5" aria-hidden />
            </ButtonLink>
          </div>
        </Card>
      ) : (
        <StudyBody userId={user.id} tz={tz} ctx={ctx} xp={xp} />
      )}
    </Page>
  );
}

async function StudyBody({ userId, tz, ctx, xp }: { userId: string; tz: string; ctx: NonNullable<Awaited<ReturnType<typeof studyContext>>>; xp: Awaited<ReturnType<typeof xpSummary>> }) {
  const { event, plan, shape, stats, cluster } = ctx;
  const r = readiness(shape, stats);
  const plan$ = await getPlanStatus(userId);
  const [judge, coach, fullExam, entry, pres] = await Promise.all([
    getAllowance(userId, "judge_run", tz, plan$),
    getAllowance(userId, "coach_message", tz, plan$),
    getAllowance(userId, "full_exam", tz, plan$),
    getAllowance(userId, "entry_check", tz, plan$),
    getAllowance(userId, "presentation_check", tz, plan$),
  ]);
  const left = (a: { unlimited: boolean; remaining: number }, unit: string, period = "today") => (a.unlimited ? "Unlimited" : `${a.remaining} ${unit}${a.remaining === 1 ? "" : "s"} left${period ? ` ${period}` : ""}`);
  const clusterId = cluster?.id;
  const ex = clusterId ? await examStats(userId, clusterId) : null;
  const streak = await streakSummary(userId, tz);
  const mistakes = clusterId ? await openMistakes(userId, clusterId) : 0;
  const [unitCount] = clusterId ? await db.select({ n: sql<number>`count(*)::int` }).from(schema.units).where(eq(schema.units.clusterId, clusterId)) : [{ n: 0 }];
  const [cardCount] = clusterId ? await db.select({ n: sql<number>`count(*)::int` }).from(schema.flashcards).where(eq(schema.flashcards.clusterId, clusterId)) : [{ n: 0 }];
  const [bank] = clusterId
    ? await db.select({ n: sql<number>`count(*)::int` }).from(schema.questions).where(and(eq(schema.questions.clusterId, clusterId), eq(schema.questions.status, "published")))
    : [{ n: 0 }];
  const exQ = clusterId ? `exam=${encodeURIComponent(clusterId)}` : "";
  const qCount = Math.min(cluster?.questionCount ?? 100, bank.n);

  const judgeTitle = event.components.presentation && !event.components.roleplay && !event.components.caseStudy ? "Presentation judge" : "Role-play judge";

  return (
    <div className="mt-5">
      <div className="stagger space-y-3">
        <EventSummary
          event={event}
          action={
            <Link href={`/study/events?federation=${event.org}`} className="rounded-full px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-subtle hover:text-fg">
              Change
            </Link>
          }
        />
        <PlanCard plan={plan} target={ctx.target} />
        <ReadinessCard score={r.score} label={r.label} parts={r.parts} />
        <TodayPlan headline={ctx.tasks.headline} tasks={ctx.tasks.tasks} />
        <LevelCard level={xp.level} total={xp.total} week={xp.week} />
      </div>

      <SectionLabel>Practice with AI</SectionLabel>
      <div className="space-y-3">
        {!features.ai() ? <Notice tone="warning">AI practice isn&apos;t configured on this server yet, so the judge and coach are unavailable. Practice tests, lessons and flashcards still work.</Notice> : null}
        {features.aiIsMock() ? <Notice>Development mode: AI responses come from a built-in test provider and are not real feedback.</Notice> : null}
        <TileGrid className={shape.judged ? "" : "grid-cols-1"}>
          {shape.judged ? (
            <Tile
              href="/study/judge"
              tone="hero"
              icon={<Mic />}
              title={judgeTitle}
              subtitle={`A realistic round with an AI judge, then a ${ORGS[event.org as OrgId].name}-style practice score.`}
              meta={<Chip tone="inverse">{left(judge, "run")}</Chip>}
              className="min-h-[13rem]"
            />
          ) : null}
          <Tile
            href="/study/coach"
            icon={<MessageCircle />}
            title="AI coach"
            subtitle="Ask about concepts, indicators and strategy."
            meta={<Chip>{left(coach, "message", "")}</Chip>}
            className={shape.judged ? "min-h-[13rem]" : undefined}
          />
        </TileGrid>
        {shape.judged || shape.written || shape.presentation ? (
          <ListGroup>
            {shape.judged ? <ListRow href="/study/judge?mode=face" icon={<User />} title="Face-to-face judge" subtitle="Sit across from an AI judge · voice, timer, optional body-language feedback" /> : null}
            {shape.judged ? <ListRow href="/study/judge-questions" icon={<Globe />} title="Judge questions" subtitle="20 likely follow-ups · answer out loud, get feedback" /> : null}
            {shape.written ? <ListRow href="/study/check?type=entry" icon={<FileText />} title="Written entry check" subtitle={`Feedback on your written entry · ${left(entry, "check", "this season")}`} /> : null}
            {shape.presentation ? <ListRow href="/study/check?type=presentation" icon={<Presentation />} title="Presentation check" subtitle={`Feedback on your outline or script · ${left(pres, "check", "this season")}`} /> : null}
          </ListGroup>
        ) : null}
      </div>

      {cluster ? (
        <>
          <SectionLabel>{cluster.name}</SectionLabel>
          <div className="space-y-3">
            <StatStrip
              items={[
                { icon: <Flame />, value: String(streak.current), label: "day streak" },
                { icon: <Check />, value: ex?.last100Accuracy !== null && ex?.last100Accuracy !== undefined ? `${Math.round(ex.last100Accuracy * 100)}%` : "–", label: "accuracy" },
                { icon: <Layers3 />, value: String(ex?.answered ?? 0), label: "questions done" },
              ]}
            />
            {bank.n === 0 ? (
              <Notice>
                We don&apos;t have an original question bank for the {cluster.name} yet. You can still use the AI coach, explain-it-back and judge tools. Lessons and practice tests will appear here when content is added.
              </Notice>
            ) : (
              <TileGrid cols={3}>
                <Tile href={`/study/practice?${exQ}&mode=quick10`} tone="accent" icon={<Zap />} title="Quick 10" subtitle="10 questions, instant explanations" />
                <Tile href={`/study/learn?${exQ}`} icon={<BookOpen />} title="Lessons" subtitle={`${unitCount.n} units · short lessons with quick checks`} />
                <Tile
                  href={`/study/practice?${exQ}&mode=full`}
                  icon={<FileText />}
                  title="Full practice exam"
                  subtitle={`${qCount} questions${cluster.minutes ? ` · ${cluster.minutes} min` : ""}, like the real test`}
                  meta={<Chip>{left(fullExam, "exam", "this season")}</Chip>}
                />
                <Tile href={`/study/practice?${exQ}&mode=rehearsal`} icon={<Timer />} title="Test-day rehearsal" subtitle="No pausing, auto-submit, compare with last time" />
                <Tile href={`/study/practice?${exQ}&mode=mistakes`} icon={<Repeat />} title="Mistake notebook" subtitle={mistakes ? `${mistakes} to clear · misses stay until you've got them` : "Every miss lands here until you've got it down"} />
                <Tile href={`/study/practice?${exQ}&mode=sprint`} icon={<Gauge />} title="60-second sprint" subtitle="As many as you can in a minute" />
                <Tile href={`/study/explain?${exQ}`} icon={<MessagesSquare />} title="Explain it back" subtitle="Say a key term in your own words" />
                <Tile href={`/study/flashcards?${exQ}`} icon={<Layers />} title="Flashcards" subtitle={`${cardCount.n} key terms for your exam`} />
                <Tile href={`/study/history?${exQ}`} icon={<History />} title="Attempt history" subtitle="Scores over time and by topic" />
              </TileGrid>
            )}
          </div>
        </>
      ) : null}
      <p className="mt-8 text-xs leading-relaxed text-muted">
        Practice scenarios and scores come from AI and are not official {ORGS[event.org as OrgId].name} materials or scores. Practice questions are original PrepX content.
      </p>
    </div>
  );
}
