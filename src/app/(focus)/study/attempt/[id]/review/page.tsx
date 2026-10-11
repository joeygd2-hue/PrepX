import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Repeat, XCircle } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { attemptReview, ExamError, MODES, type Mode } from "@/server/exams";
import { ButtonLink } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress";
import { BackHeader } from "@/components/ui/page";
import { Card, HeroTexture, SectionLabel } from "@/components/ui/card";
import { cn } from "@/lib/cn";

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
    <main id="main" className="mx-auto max-w-2xl px-4 pb-16 pt-7 sm:px-6 sm:pt-10">
      <BackHeader href={a.mode === "check" && a.unitId ? `/study/learn/${a.unitId}` : "/study"} title={MODES[mode]?.label ?? "Results"} />
      <section className="relative overflow-hidden rounded-[28px] bg-hero p-6 text-hero-fg shadow-float sm:p-8">
        <HeroTexture />
        <div className="relative">
          {mode === "sprint" ? (
            <>
              <p className="font-mono text-[5rem] font-medium leading-[0.8] tracking-[-0.06em] tabular sm:text-[6.5rem]">{a.correct}</p>
              <p className="mt-5 text-hero-muted">correct in 60 seconds · {a.total} answered</p>
              {r.sprintBest !== null && (a.correct ?? 0) >= r.sprintBest ? (
                <p className="pop-in mt-5 inline-flex h-7 items-center rounded-full bg-accent px-3 text-sm font-semibold text-accent-fg">New personal best!</p>
              ) : (
                <p className="mt-5 font-mono text-sm text-hero-muted tabular">{`Personal best: ${r.sprintBest}`}</p>
              )}
            </>
          ) : (
            <>
              <p className="flex items-end gap-1.5">
                <span className="font-mono text-[5rem] font-medium leading-[0.8] tracking-[-0.06em] tabular sm:text-[6.5rem]">{pct}</span>
                <span className="pb-1 font-mono text-2xl text-hero-muted">%</span>
              </p>
              <p className="mt-5 text-hero-muted">
                {a.correct} of {a.total} correct{minutes !== null && a.timeLimitSec ? ` · ${minutes} min` : ""}
              </p>
              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-hero-line" aria-hidden>
                <div className="h-full rounded-full bg-accent transition-[width] duration-1000 ease-out" style={{ width: `${pct}%` }} />
              </div>
              {prevPct !== null ? (
                <p className="mt-5 font-mono text-sm text-hero-muted tabular">
                  Last time: {prevPct}% · <span className="text-hero-fg">{pct - prevPct >= 0 ? `+${pct - prevPct}` : pct - prevPct} points</span>
                </p>
              ) : null}
            </>
          )}
        </div>
      </section>

      <div className="mt-4 flex flex-wrap gap-3">
        <ButtonLink href="/study" variant="primary">
          Back to Study
        </ButtonLink>
        {r.items.some((i) => !i.answer?.correct) ? (
          <ButtonLink href={`/study/practice?exam=${a.clusterId}&mode=mistakes`} variant="outline">
            <Repeat className="size-4" aria-hidden /> Practice misses
          </ButtonLink>
        ) : null}
      </div>

      {r.topics.length > 1 ? (
        <section>
          <SectionLabel>By topic</SectionLabel>
          <Card className="space-y-4">
            {r.topics
              .sort((x, y) => x.correct / x.total - y.correct / y.total)
              .map((t) => (
                <div key={t.title}>
                  <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0">{t.title}</span>
                    <span className="shrink-0 font-mono font-medium tabular">
                      {t.correct}/{t.total}
                    </span>
                  </div>
                  <ProgressBar value={t.correct} max={t.total} label={t.title} />
                </div>
              ))}
          </Card>
        </section>
      ) : null}

      <section>
        <div className="mt-10 mb-3 flex items-center gap-3">
          <h2 className="eyebrow flex shrink-0 items-center gap-3">
            <span className="size-1.5 shrink-0 rounded-full bg-accent shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_25%,transparent)]" aria-hidden />
            Review
          </h2>
          <span className="h-px flex-1 bg-border" aria-hidden />
          <nav className="flex shrink-0 gap-1 rounded-[12px] bg-subtle p-1 text-sm">
            <Link
              href={`?`}
              aria-current={filter !== "missed"}
              className={cn("rounded-[9px] px-3 py-1 font-medium transition-colors", filter !== "missed" ? "bg-card text-fg shadow-card" : "text-muted hover:text-fg")}
            >
              All
            </Link>
            <Link
              href={`?filter=missed`}
              aria-current={filter === "missed"}
              className={cn("rounded-[9px] px-3 py-1 font-medium transition-colors", filter === "missed" ? "bg-card text-fg shadow-card" : "text-muted hover:text-fg")}
            >
              Missed
            </Link>
          </nav>
        </div>
        <ol className="stagger space-y-3">
          {items.map((it, n) => {
            const correct = Boolean(it.answer?.correct);
            return (
              <li key={it.id}>
                <Card>
                  <div className="flex gap-3.5">
                    {correct ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-label="Correct" /> : <XCircle className="mt-0.5 size-5 shrink-0 text-danger" aria-label="Incorrect" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted">
                        <span className="font-mono tabular">{n + 1}.</span> {it.unitTitle}
                        {it.source === "ai_generated" ? " · AI-generated practice question" : ""}
                      </p>
                      <p className="mt-1.5 font-medium leading-snug tracking-[-0.01em]">{it.stem}</p>
                      <div className="mt-4 space-y-2 text-sm">
                        <p className={cn("rounded-[12px] px-3 py-2 leading-relaxed", correct ? "bg-success/10" : "bg-danger/10")}>
                          <span className={correct ? "text-success" : "text-danger"}>Your answer:</span>{" "}
                          {it.answer?.chosenIndex !== null && it.answer?.chosenIndex !== undefined ? `${LETTERS[it.answer.chosenIndex]}. ${it.choices[it.answer.chosenIndex]}` : "No answer"}
                        </p>
                        {!correct ? (
                          <p className="rounded-[12px] bg-success/10 px-3 py-2 leading-relaxed">
                            <span className="text-success">Correct:</span> {LETTERS[it.answerIndex]}. {it.choices[it.answerIndex]}
                          </p>
                        ) : null}
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-muted">{it.explanation}</p>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}
