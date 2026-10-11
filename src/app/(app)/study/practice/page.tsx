import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
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
  quick10: ["Adaptive · 10 questions at your level, instant explanations"],
  full: ["Answers and explanations are revealed after you submit.", "You can leave and come back; your answers and time are saved.", "Questions are original PrepX practice, not official exam items."],
  rehearsal: ["Exam conditions: no pausing. The clock keeps running if you leave.", "Auto-submits when time runs out.", "Your score is compared with your last rehearsal."],
  sprint: ["Answer as many as you can in 60 seconds.", "Beat your personal best."],
  mistakes: ["Questions you've missed. Get each one right twice in a row to clear it."],
  unit: ["10 practice questions from this unit with instant explanations."],
  bookmarks: ["Up to 20 of your bookmarked questions from this bank, shuffled.", "See the right answer and explanation after each question."],
};

type Param = string | string[] | undefined;
const one = (v: Param) => (typeof v === "string" && v.length <= 100 ? v : undefined);

export default async function PracticeStart({ searchParams }: { searchParams: Promise<{ exam?: Param; mode?: Param; unit?: Param }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [exam, mode, unit] = [one(sp.exam), one(sp.mode), one(sp.unit)];
  // Lesson checks start from the lesson page and duels from the Duels page.
  if (!exam || !isMode(mode) || mode === "check" || mode === "duel") notFound();
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
  // Mirrors startAttempt's resume rule (sprints always start fresh; unit practice resumes per unit).
  const [resumable] =
    mode === "sprint"
      ? []
      : await db
          .select({ n: sql<number>`jsonb_array_length(${schema.examAttempts.questionIds})::int` })
          .from(schema.examAttempts)
          .where(
            and(
              eq(schema.examAttempts.userId, user.id),
              eq(schema.examAttempts.clusterId, exam),
              eq(schema.examAttempts.mode, mode),
              isNull(schema.examAttempts.submittedAt),
              unit ? eq(schema.examAttempts.unitId, unit) : undefined,
            ),
          )
          .orderBy(desc(schema.examAttempts.startedAt))
          .limit(1);
  const open = resumable ? 1 : 0;
  const [{ saved }] =
    mode === "bookmarks"
      ? await db
          .select({ saved: sql<number>`count(*)::int` })
          .from(schema.questionBookmarks)
          .innerJoin(schema.questions, eq(schema.questions.id, schema.questionBookmarks.questionId))
          .where(and(eq(schema.questionBookmarks.userId, user.id), eq(schema.questions.clusterId, exam), eq(schema.questions.status, "published")))
      : [{ saved: 0 }];
  const back = mode === "bookmarks" ? `/study/bookmarks?exam=${encodeURIComponent(exam)}` : "/study";
  if (mode === "bookmarks" && saved === 0 && open === 0)
    return (
      <Page>
        <BackHeader href={back} title={MODES[mode].label} subtitle={cluster.name} />
        <Notice>You haven&apos;t bookmarked any questions in this bank yet. After you answer a practice question, tap the bookmark to save it for later.</Notice>
        <ButtonLink href={`/study/practice?exam=${encodeURIComponent(exam)}&mode=quick10`} variant="accent" className="mt-4">
          Start a Quick 10 <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-0.5" aria-hidden />
        </ButtonLink>
      </Page>
    );
  const allowance = mode === "full" || mode === "rehearsal" ? await getAllowance(user.id, "full_exam", user.profile!.timezone) : null;
  const count = resumable
    ? resumable.n
    : mode === "full" || mode === "rehearsal"
      ? Math.min(cluster.questionCount ?? 100, bank)
      : Math.min(MODES[mode].count, mode === "bookmarks" ? saved : bank);
  const minutes = mode === "full" || mode === "rehearsal" ? Math.round(((cluster.minutes ?? 60) * count) / (cluster.questionCount ?? count)) : null;
  const copy = COPY[mode] ?? [];
  return (
    <Page>
      <BackHeader href={back} title={MODES[mode].label} subtitle={cluster.name} />
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
