import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { attemptReview, ExamError, MODES, type Mode } from "@/server/exams";
import { ButtonLink } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress";
import { BackHeader } from "@/components/ui/page";

export const metadata: Metadata = { title: "Results" };
const LETTERS = ["A", "B", "C", "D", "E", "F"];

export default async function Review({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ filter?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { filter } = await searchParams;
  let r;
  try {
    r = await attemptReview(user.id, id);
  } catch (e) {
    if (e instanceof ExamError) notFound();
    throw e;
  }
  const a = r.attempt;
  const mode = a.mode as Mode;
  const pct = a.total ? Math.round(((a.correct ?? 0) / a.total) * 100) : 0;
  const prevPct = r.previous?.total ? Math.round(((r.previous.correct ?? 0) / r.previous.total) * 100) : null;
  const items = filter === "missed" ? r.items.filter((i) => !i.answer?.correct) : r.items;
  const minutes = a.submittedAt ? Math.round(((a.allowPause && a.timeLimitSec ? a.elapsedSec * 1000 : a.submittedAt.getTime() - a.startedAt.getTime()) / 60000) * 10) / 10 : null;

  return (
    <main id="main" className="mx-auto max-w-2xl px-4 pb-16 pt-6 sm:px-6">
      <BackHeader href={a.mode === "check" && a.unitId ? `/study/learn/${a.unitId}` : "/study"} title={MODES[mode]?.label ?? "Results"} />
      <section className="rounded-3xl bg-fg p-6 text-bg">
        {mode === "sprint" ? (
          <>
            <p className="text-6xl font-semibold tabular">{a.correct}</p>
            <p className="opacity-80">correct in 60 seconds · {a.total} answered</p>
            <p className="mt-3">{r.sprintBest !== null && (a.correct ?? 0) >= r.sprintBest ? "New personal best!" : `Personal best: ${r.sprintBest}`}</p>
          </>
        ) : (
          <>
            <p className="text-6xl font-semibold tabular">{pct}%</p>
            <p className="opacity-80">
              {a.correct} of {a.total} correct{minutes !== null && a.timeLimitSec ? ` · ${minutes} min` : ""}
            </p>
            {prevPct !== null ? (
              <p className="mt-3">
                Last time: {prevPct}% · {pct - prevPct >= 0 ? `+${pct - prevPct}` : pct - prevPct} points
              </p>
            ) : null}
          </>
        )}
      </section>

      {r.topics.length > 1 ? (
        <section className="mt-6">
          <h2 className="eyebrow mb-3">By topic</h2>
          <div className="space-y-3 rounded-3xl border border-border p-5">
            {r.topics
              .sort((x, y) => x.correct / x.total - y.correct / y.total)
              .map((t) => (
                <div key={t.title}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{t.title}</span>
                    <span className="tabular">
                      {t.correct}/{t.total}
                    </span>
                  </div>
                  <ProgressBar value={t.correct} max={t.total} label={t.title} />
                </div>
              ))}
          </div>
        </section>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href="/study" variant="primary">
          Back to Study
        </ButtonLink>
        {r.items.some((i) => !i.answer?.correct) ? (
          <ButtonLink href={`/study/practice?exam=${a.clusterId}&mode=mistakes`} variant="outline">
            Practice misses
          </ButtonLink>
        ) : null}
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="eyebrow">Review</h2>
          <nav className="flex gap-2 text-sm">
            <Link href={`?`} aria-current={filter !== "missed"} className={filter !== "missed" ? "font-semibold" : "text-muted"}>
              All
            </Link>
            <Link href={`?filter=missed`} aria-current={filter === "missed"} className={filter === "missed" ? "font-semibold" : "text-muted"}>
              Missed
            </Link>
          </nav>
        </div>
        <ol className="space-y-4">
          {items.map((it, n) => (
            <li key={it.id} className="rounded-3xl border border-border p-5">
              <div className="flex gap-3">
                {it.answer?.correct ? <CheckCircle2 className="size-5 shrink-0 text-success" aria-label="Correct" /> : <XCircle className="size-5 shrink-0 text-danger" aria-label="Incorrect" />}
                <div className="min-w-0">
                  <p className="text-xs text-muted">
                    {n + 1}. {it.unitTitle}
                    {it.source === "ai_generated" ? " · AI-generated practice question" : ""}
                  </p>
                  <p className="mt-1 font-medium">{it.stem}</p>
                  <p className="mt-2 text-sm">
                    Your answer: {it.answer?.chosenIndex !== null && it.answer?.chosenIndex !== undefined ? `${LETTERS[it.answer.chosenIndex]}. ${it.choices[it.answer.chosenIndex]}` : "No answer"}
                  </p>
                  {!it.answer?.correct ? (
                    <p className="text-sm">
                      Correct: {LETTERS[it.answerIndex]}. {it.choices[it.answerIndex]}
                    </p>
                  ) : null}
                  <p className="mt-2 text-sm text-muted">{it.explanation}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
