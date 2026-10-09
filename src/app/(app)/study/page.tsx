import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, sql } from "drizzle-orm";
import { ArrowRight, BookOpen, Check, FileText, Flame, Globe, History, Layers, MessageCircle, MessagesSquare, Mic, Presentation, Repeat, Timer, User, Zap, Layers3 } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { studyContext } from "@/server/dashboard";
import { examStats, openMistakes, streakSummary, xpSummary } from "@/server/progress";
import { getAllowance, getPlanStatus } from "@/server/entitlements";
import { readiness } from "@/lib/plan";
import { ORGS, type OrgId } from "@/lib/orgs";
import { Page } from "@/components/ui/page";
import { ListGroup, ListRow } from "@/components/ui/list";
import { SectionLabel } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
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
      <p className="eyebrow">Study</p>
      <h1 className="mb-5 text-[2rem] font-semibold leading-tight tracking-tight">Your event</h1>
      <OrgSwitcher value={org} />
      {!ctx ? (
        <section className="mt-6 rounded-3xl bg-subtle p-6">
          <h2 className="text-xl font-semibold">Choose your {ORGS[org].name} event</h2>
          <p className="mt-2 text-muted">Pick an event to unlock a countdown, a smart study plan and practice tools built around it.</p>
          <ButtonLink href={`/study/events?federation=${org}`} className="mt-5">
            <ArrowRight className="size-4" aria-hidden /> Browse {ORGS[org].name} events
          </ButtonLink>
        </section>
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

  return (
    <div className="mt-6 space-y-4">
      <EventSummary
        event={event}
        action={
          <Link href={`/study/events?federation=${event.org}`} className="text-sm font-medium hover:underline">
            Change
          </Link>
        }
      />
      <PlanCard plan={plan} target={ctx.target} />
      <ReadinessCard score={r.score} label={r.label} parts={r.parts} />
      <TodayPlan headline={ctx.tasks.headline} tasks={ctx.tasks.tasks} />
      <LevelCard level={xp.level} total={xp.total} week={xp.week} />

      {!features.ai() ? <Notice tone="warning">AI practice isn&apos;t configured on this server yet, so the judge and coach are unavailable. Practice tests, lessons and flashcards still work.</Notice> : null}
      {features.aiIsMock() ? <Notice>Development mode: AI responses come from a built-in test provider and are not real feedback.</Notice> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {shape.judged ? (
          <Link href="/study/judge" className="flex flex-col rounded-3xl bg-fg p-5 text-bg hover:opacity-95">
            <div className="flex items-start justify-between">
              <span className="inline-flex size-11 items-center justify-center rounded-xl bg-bg text-fg">
                <Mic className="size-5" aria-hidden />
              </span>
              <ArrowRight className="size-5" aria-hidden />
            </div>
            <span className="mt-6 text-xl font-semibold">{event.components.presentation && !event.components.roleplay && !event.components.caseStudy ? "Presentation judge" : "Role-play judge"}</span>
            <span className="mt-2 text-sm opacity-80">A realistic practice round with an AI judge, then a {ORGS[event.org as OrgId].name}-style practice score.</span>
            <span className="mt-4">
              <Chip tone="inverse">{left(judge, "run")}</Chip>
            </span>
          </Link>
        ) : null}
        <Link href="/study/coach" className="flex flex-col rounded-3xl bg-subtle p-5 hover:bg-subtle-2">
          <div className="flex items-start justify-between">
            <span className="inline-flex size-11 items-center justify-center rounded-xl bg-fg text-bg">
              <MessageCircle className="size-5" aria-hidden />
            </span>
            <ArrowRight className="size-5" aria-hidden />
          </div>
          <span className="mt-6 text-xl font-semibold">AI coach</span>
          <span className="mt-2 text-sm text-muted">Ask about concepts, indicators and strategy.</span>
          <span className="mt-4">
            <Chip>{left(coach, "message", "")}</Chip>
          </span>
        </Link>
      </div>

      {shape.judged || shape.written || shape.presentation ? (
        <ListGroup>
          {shape.judged ? <ListRow href="/study/judge?mode=face" icon={<User />} title="Face-to-face judge" subtitle="Sit across from an AI judge · voice, timer, optional body-language feedback" /> : null}
          {shape.judged ? <ListRow href="/study/judge-questions" icon={<Globe />} title="Judge questions" subtitle="20 likely follow-ups · answer out loud, get feedback" /> : null}
          {shape.written ? <ListRow href="/study/check?type=entry" icon={<FileText />} title="Written entry check" subtitle={`Feedback on your written entry · ${left(entry, "check", "this season")}`} /> : null}
          {shape.presentation ? <ListRow href="/study/check?type=presentation" icon={<Presentation />} title="Presentation check" subtitle={`Feedback on your outline or script · ${left(pres, "check", "this season")}`} /> : null}
        </ListGroup>
      ) : null}

      {cluster ? (
        <>
          <SectionLabel>{cluster.name}</SectionLabel>
          <div className="grid grid-cols-3 gap-3">
            <Stat icon={<Flame />} value={String(streak.current)} label="day streak" />
            <Stat icon={<Check />} value={ex?.last100Accuracy !== null && ex?.last100Accuracy !== undefined ? `${Math.round(ex.last100Accuracy * 100)}%` : "–"} label="accuracy" />
            <Stat icon={<Layers3 />} value={String(ex?.answered ?? 0)} label="questions done" />
          </div>
          {bank.n === 0 ? (
            <Notice>
              We don&apos;t have an original question bank for the {cluster.name} yet. You can still use the AI coach, explain-it-back and judge tools. Lessons and practice tests will appear here when content is added.
            </Notice>
          ) : (
            <ListGroup>
              <ListRow href={`/study/learn?${exQ}`} icon={<BookOpen />} title="Lessons" subtitle={`${unitCount.n} units · short lessons with quick checks`} />
              <ListRow href={`/study/practice?${exQ}&mode=quick10`} icon={<Zap />} title="Quick 10" subtitle="10 questions, instant explanations" />
              <ListRow
                href={`/study/practice?${exQ}&mode=full`}
                icon={<FileText />}
                title="Full practice exam"
                subtitle={`${qCount} questions${cluster.minutes ? ` · ${cluster.minutes} minutes` : ""}, like the real test · ${left(fullExam, "exam", "this season")}`}
              />
              <ListRow href={`/study/practice?${exQ}&mode=rehearsal`} icon={<Timer />} title="Test-day rehearsal" subtitle="Exam conditions: no pausing, auto-submit, compare with last time" />
              <ListRow href={`/study/practice?${exQ}&mode=mistakes`} icon={<Repeat />} title="Mistake notebook" subtitle={mistakes ? `${mistakes} to clear · every miss lands here until you've got it down` : "Every miss lands here until you've got it down"} />
              <ListRow href={`/study/practice?${exQ}&mode=sprint`} icon={<Zap />} title="60-second sprint" subtitle="As many as you can in a minute · beat your best" />
              <ListRow href={`/study/explain?${exQ}`} icon={<MessagesSquare />} title="Explain it back" subtitle="Say a key term in your own words · AI checks you get it" />
              <ListRow href={`/study/flashcards?${exQ}`} icon={<Layers />} title="Flashcards" subtitle={`${cardCount.n} key terms for your exam`} />
              <ListRow href={`/study/history?${exQ}`} icon={<History />} title="Attempt history" subtitle="Scores over time and topic breakdown" />
            </ListGroup>
          )}
        </>
      ) : null}
      <p className="pt-2 text-sm text-muted">
        Practice scenarios and scores come from AI and are not official {ORGS[event.org as OrgId].name} materials or scores. Practice questions are original PrepX content.
      </p>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-3xl bg-subtle p-4 [&>svg]:size-5">
      {icon}
      <p className="mt-2 text-2xl font-semibold tabular">{value}</p>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}
