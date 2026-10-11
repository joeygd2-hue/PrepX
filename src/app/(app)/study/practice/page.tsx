import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq, isNull, sql } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { getAllowance } from "@/server/entitlements";
import { isMode, MODES } from "@/server/exams";
import { BackHeader, Page } from "@/components/ui/page";
import { Card, HeroTexture } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/form";
import { StartForm } from "./start-form";

export const metadata: Metadata = { title: "Practice" };

const COPY: Record<string, string[]> = {
  quick10: ["10 questions picked from what you haven't seen or missed.", "See the right answer and explanation after each question."],
  full: ["Answers and explanations are revealed after you submit.", "You can leave and come back; your answers and time are saved.", "Questions are original PrepX practice, not official exam items."],
  rehearsal: ["Exam conditions: no pausing. The clock keeps running if you leave.", "Auto-submits when time runs out.", "Your score is compared with your last rehearsal."],
  sprint: ["Answer as many as you can in 60 seconds.", "Beat your personal best."],
  mistakes: ["Questions you've missed. Get each one right twice in a row to clear it."],
  unit: ["10 practice questions from this unit with instant explanations."],
};

export default async function PracticeStart({ searchParams }: { searchParams: Promise<{ exam?: string; mode?: string; unit?: string }> }) {
  const user = await requireUser();
  const { exam, mode, unit } = await searchParams;
  if (!exam || !isMode(mode) || mode === "check") notFound();
  const [cluster] = await db.select().from(schema.examClusters).where(eq(schema.examClusters.id, exam));
  if (!cluster) notFound();
  if ((mode === "full" || mode === "rehearsal") && cluster.kind !== "exam")
    return (
      <Page>
        <BackHeader href="/study" title={MODES[mode].label} subtitle={cluster.name} />
        <Notice>This study bank isn&apos;t an official test, so there&apos;s no full exam to simulate. Practice it with Quick 10 instead.</Notice>
        <ButtonLink href={`/study/practice?exam=${encodeURIComponent(exam)}&mode=quick10`} variant="accent" className="mt-4">
          Practice with Quick 10 <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-0.5" aria-hidden />
        </ButtonLink>
      </Page>
    );
  const [{ bank }] = await db
    .select({ bank: sql<number>`count(*)::int` })
    .from(schema.questions)
    .where(and(eq(schema.questions.clusterId, exam), eq(schema.questions.status, "published")));
  const [{ open }] = await db
    .select({ open: sql<number>`count(*)::int` })
    .from(schema.examAttempts)
    .where(and(eq(schema.examAttempts.userId, user.id), eq(schema.examAttempts.clusterId, exam), eq(schema.examAttempts.mode, mode), isNull(schema.examAttempts.submittedAt)));
  const allowance = mode === "full" || mode === "rehearsal" ? await getAllowance(user.id, "full_exam", user.profile!.timezone) : null;
  const count = mode === "full" || mode === "rehearsal" ? Math.min(cluster.questionCount ?? 100, bank) : Math.min(MODES[mode].count, bank);
  const minutes = mode === "full" || mode === "rehearsal" ? Math.round(((cluster.minutes ?? 60) * count) / (cluster.questionCount ?? count)) : null;
  const copy = COPY[mode] ?? [];
  return (
    <Page>
      <BackHeader href="/study" title={MODES[mode].label} subtitle={cluster.name} />
      <Card tone="inverse" className="p-6 shadow-float sm:p-8">
        <HeroTexture />
        <div className="relative">
          <p className="flex flex-wrap items-end gap-x-3 gap-y-2">
            <span className="font-mono text-[5rem] font-medium leading-[0.8] tracking-[-0.06em] tabular sm:text-[6rem]">{mode === "sprint" ? "60s" : count}</span>
            <span className="pb-1 text-lg text-hero-muted">{mode === "sprint" ? "on the clock" : `question${count === 1 ? "" : "s"}${minutes ? ` · ${minutes} minutes` : ""}`}</span>
          </p>
          {(mode === "full" || mode === "rehearsal") && bank < (cluster.questionCount ?? 100) ? (
            <p className="mt-5 max-w-md text-sm leading-relaxed text-hero-muted">
              The real exam has {cluster.questionCount ?? 100} questions; our original bank currently has {bank}, so this exam is shorter with time scaled to match.
            </p>
          ) : null}
          {copy.length ? (
            <ul className="mt-7 space-y-2.5 border-t border-hero-line pt-6 text-[15px] leading-relaxed">
              {copy.map((l) => (
                <li key={l} className="flex gap-3">
                  <span aria-hidden className="mt-[0.7em] h-px w-3 shrink-0 bg-hero-muted" />
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <StartForm
            exam={exam}
            mode={mode}
            unit={unit}
            resume={open > 0}
            allowanceNote={allowance && !allowance.unlimited ? `Uses 1 of your ${allowance.limit} full practice exams this season (${allowance.remaining} left).` : null}
            disabled={Boolean(allowance && !allowance.unlimited && allowance.remaining <= 0 && open === 0)}
          />
        </div>
      </Card>
    </Page>
  );
}
