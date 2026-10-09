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
        <p className="text-muted">Choose your event to set goals.</p>
        <ButtonLink href="/study/events" className="mt-4">
          Choose event
        </ButtonLink>
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
      <section className="rounded-3xl bg-fg p-6 text-bg">
        <p className="eyebrow !text-bg/70">Weekly pace</p>
        <p className="mt-2 text-xl font-semibold">
          {pace === null ? "Set a competition date to get a weekly pace." : pace === 0 ? "You're at your readiness target. Keep it there!" : `Gain about ${pace} readiness points a week to reach ${g.targetReadiness} by competition day.`}
        </p>
        <p className="mt-2 text-sm opacity-80">
          Readiness now: {r.score}
          {weeks ? ` · ${weeks} week${weeks === 1 ? "" : "s"} left` : ""}
        </p>
      </section>
      <section className="mt-4 space-y-4 rounded-3xl border border-border p-5">
        <div>
          <div className="mb-1 flex justify-between text-sm">
            <span>Questions this week</span>
            <span className="tabular">
              {q}/{g.weeklyQuestions}
            </span>
          </div>
          <ProgressBar value={q} max={Math.max(g.weeklyQuestions, 1)} label="Weekly questions" />
        </div>
        {ctx.shape.judged ? (
          <div>
            <div className="mb-1 flex justify-between text-sm">
              <span>Judge runs this week</span>
              <span className="tabular">
                {j}/{g.weeklyJudgeRuns}
              </span>
            </div>
            <ProgressBar value={j} max={Math.max(g.weeklyJudgeRuns, 1)} label="Weekly judge runs" />
          </div>
        ) : null}
      </section>
      <GoalsForm eventId={ctx.event.id} initial={g} judged={ctx.shape.judged} />
      <p className="mt-4 text-sm text-muted">Goals are for you. Rest matters too: a steady 20 minutes most days beats cramming.</p>
    </Page>
  );
}
