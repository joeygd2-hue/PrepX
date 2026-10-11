import type { Metadata } from "next";
import { and, eq, gte, sql, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { studyContext } from "@/server/dashboard";
import { readiness } from "@/lib/plan";
import { addDays, todayIn } from "@/lib/dates";
import { BackHeader, Page } from "@/components/ui/page";
import { ProgressBar } from "@/components/ui/progress";
import { ButtonLink } from "@/components/ui/button";
import { Card, HeroTexture } from "@/components/ui/card";
import { GoalsForm } from "./form";

export const metadata: Metadata = { title: "Season goals" };

export default async function Goals() {
  const user = await requireUser();
  const tz = user.profile!.timezone;
  const ctx = await studyContext(user.id, tz, user.profile!.dailyStudyMinutes);
  if (!ctx)
    return (
      <Page>
        <BackHeader href="/" title="Season goals" />
        <Card tone="subtle">
          <p className="text-muted">Choose your event to set goals.</p>
          <ButtonLink href="/study/events" className="mt-4">
            Choose event
          </ButtonLink>
        </Card>
      </Page>
    );
  const [goal] = await db.select().from(schema.seasonGoals).where(and(eq(schema.seasonGoals.userId, user.id), eq(schema.seasonGoals.eventId, ctx.event.id)));
  const g = goal ?? { targetReadiness: 80, weeklyQuestions: 100, weeklyJudgeRuns: 1 };
  const weekStart = new Date(`${addDays(todayIn(tz), -6)}T00:00:00Z`);
  const [{ q }] = await db.select({ q: sql<number>`count(*)::int` }).from(schema.attemptAnswers).where(and(eq(schema.attemptAnswers.userId, user.id), gte(schema.attemptAnswers.answeredAt, weekStart)));
  const [{ j }] = await db
    .select({ j: sql<number>`count(*)::int` })
    .from(schema.aiSessions)
    .where(and(eq(schema.aiSessions.userId, user.id), inArray(schema.aiSessions.kind, ["judge", "face_to_face"]), eq(schema.aiSessions.status, "scored"), gte(schema.aiSessions.updatedAt, weekStart)));
  const r = readiness(ctx.shape, ctx.stats);
  const weeks = ctx.daysLeft ? Math.max(1, Math.ceil(ctx.daysLeft / 7)) : null;
  const pace = weeks ? Math.max(0, Math.ceil((g.targetReadiness - r.score) / weeks)) : null;
  return (
    <Page>
      <BackHeader href="/" title="Season goals" subtitle={`${ctx.event.code} · ${ctx.event.name}`} />
      <Card tone="inverse" className="p-6 shadow-float sm:p-8">
        <HeroTexture />
        <div className="relative">
          <p className="eyebrow !text-hero-muted">Weekly pace</p>
          <p className="mt-5 text-[1.5rem] font-semibold leading-snug tracking-[-0.025em] sm:text-[1.75rem]">
            {pace === null ? (
              "Set a competition date to get a weekly pace."
            ) : pace === 0 ? (
              "You're at your readiness target. Keep it there!"
            ) : (
              <>
                Gain about <span className="font-mono font-medium tracking-[-0.04em] tabular">{pace}</span> readiness points a week to reach{" "}
                <span className="font-mono font-medium tracking-[-0.04em] tabular">{g.targetReadiness}</span> by competition day.
              </>
            )}
          </p>
          <div className="mt-7 border-t border-hero-line pt-5">
            <ProgressBar inverse value={r.score} max={Math.max(g.targetReadiness, 1)} label="Readiness toward your target" />
            <p className="mt-3 text-sm text-hero-muted">
              Readiness now: <span className="font-mono text-hero-fg tabular">{r.score}</span>
              {weeks ? (
                <>
                  {" · "}
                  <span className="font-mono text-hero-fg tabular">{weeks}</span> week{weeks === 1 ? "" : "s"} left
                </>
              ) : null}
            </p>
          </div>
        </div>
      </Card>
      <Card className="mt-3 space-y-5">
        <Meter label="Questions this week" value={q} goal={g.weeklyQuestions} aria="Weekly questions" />
        {ctx.shape.judged ? <Meter label="Judge runs this week" value={j} goal={g.weeklyJudgeRuns} aria="Weekly judge runs" /> : null}
      </Card>
      <div className="mt-3">
        <GoalsForm eventId={ctx.event.id} initial={g} judged={ctx.shape.judged} />
      </div>
      <p className="mt-4 px-1 text-sm text-muted">Goals are for you. Rest matters too: a steady 20 minutes most days beats cramming.</p>
    </Page>
  );
}

function Meter({ label, value, goal, aria }: { label: string; value: number; goal: number; aria: string }) {
  return (
    <div>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <span className="font-medium tracking-[-0.01em]">{label}</span>
        <span className="font-mono text-sm tabular">
          {value}
          <span className="text-muted">/{goal}</span>
        </span>
      </div>
      <ProgressBar value={value} max={Math.max(goal, 1)} label={aria} />
    </div>
  );
}
