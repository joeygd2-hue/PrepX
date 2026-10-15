"use client";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, HeroTexture } from "@/components/ui/card";
import { BackHeader, Page } from "@/components/ui/page";
import { ProgressBar } from "@/components/ui/progress";
import { cn } from "@/lib/cn";
import { advanceAction, quizAnswerAction } from "@/app/actions/quiz";
import type { gameState } from "@/server/quiz";

type S = Awaited<ReturnType<typeof gameState>>;
const LETTERS = ["A", "B", "C", "D"];

export function Live({ initial }: { initial: S }) {
  const [s, setS] = useState(initial);
  const [pending, start] = useTransition();
  const [pickedAt, setPickedAt] = useState<{ index: number; choice: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (s.status === "ended") return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/quiz/${s.id}`, { cache: "no-store" });
      if (r.ok) setS(await r.json());
    }, 1500);
    return () => clearInterval(t);
  }, [s.id, s.status]);
  const picked = pickedAt && pickedAt.index === s.index ? pickedAt.choice : null;

  const refresh = async () => {
    const r = await fetch(`/api/quiz/${s.id}`, { cache: "no-store" });
    if (r.ok) setS(await r.json());
  };

  return (
    <Page>
      <BackHeader href="/chapter/quiz" title="Quiz night" subtitle={s.chapterName} />
      {s.status === "lobby" ? (
        <Card tone="inverse" className="p-8 text-center shadow-float sm:p-10">
          <HeroTexture />
          <div className="relative">
            <p className="text-[2rem] font-semibold leading-tight tracking-[-0.035em]">Get ready!</p>
            <p className="mx-auto mt-2 max-w-sm text-hero-muted">{s.total} questions. Faster correct answers score more points.</p>
            {s.isHost ? null : (
              <p className="mt-5 inline-flex items-center gap-2 text-sm text-hero-muted">
                <span aria-hidden className="relative inline-flex size-2">
                  <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-60" />
                  <span className="relative size-2 rounded-full bg-accent" />
                </span>
                Waiting for the host to start…
              </p>
            )}
          </div>
        </Card>
      ) : null}
      {s.question && s.status !== "lobby" ? (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="font-mono text-xs uppercase tracking-[0.12em] text-muted tabular">
              Question {s.index + 1} of {s.total}
            </span>
            {s.secondsLeft !== null ? (
              <span
                className={cn(
                  "inline-flex h-9 min-w-14 items-center justify-center rounded-full px-3 font-mono text-sm font-semibold tabular",
                  s.secondsLeft <= 5 ? "bg-accent text-accent-fg" : "bg-primary text-primary-fg",
                )}
                role="timer"
              >
                {s.secondsLeft}s
              </span>
            ) : null}
          </div>
          <ProgressBar value={s.index + 1} max={s.total} label="Game progress" />
          <h1 className="mt-6 text-2xl font-semibold leading-snug tracking-[-0.025em] [overflow-wrap:anywhere]">{s.question.stem}</h1>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {s.question.choices.map((c, i) => {
              const mine = (s.myAnswer?.chosen ?? picked) === i;
              const right = s.question!.answerIndex === i;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={s.status !== "live" || s.myAnswer !== null || picked !== null || s.isHost}
                  onClick={() => {
                    setPickedAt({ index: s.index, choice: i });
                    start(async () => {
                      const r = await quizAnswerAction(s.id, s.index, i);
                      if (!r.ok) setError(r.error ?? null);
                      await refresh();
                    });
                  }}
                  className={cn(
                    "flex items-start gap-3 rounded-[16px] border bg-card p-4 text-left font-medium transition-[border-color,box-shadow,opacity] disabled:cursor-default",
                    s.status === "live" && mine && "border-fg ring-4 ring-accent/30",
                    s.status === "live" && !mine && "border-border shadow-card enabled:hover:border-border-strong",
                    s.status !== "live" && right && "border-success bg-success/10",
                    s.status !== "live" && !right && mine && "border-danger bg-danger/10",
                    s.status !== "live" && !right && !mine && "border-border opacity-60",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-7 shrink-0 items-center justify-center rounded-[8px] font-mono text-xs font-semibold",
                      s.status === "live" && mine ? "bg-primary text-primary-fg" : "bg-subtle",
                      s.status !== "live" && right && "bg-success/15 text-success",
                      s.status !== "live" && !right && mine && "bg-danger/15 text-danger",
                    )}
                  >
                    {LETTERS[i]}
                  </span>
                  <span className="min-w-0 flex-1 pt-0.5 [overflow-wrap:anywhere]">{c}</span>
                  {s.counts ? <span className="shrink-0 pt-0.5 font-mono text-sm text-muted tabular">{s.counts[i]}</span> : null}
                </button>
              );
            })}
          </div>
          {s.status === "live" && (s.myAnswer || picked !== null) ? <p className="mt-4 text-sm text-muted">Answer locked in. Waiting for the reveal…</p> : null}
          {s.status !== "live" && s.myAnswer ? (
            <p className="mt-4 text-lg font-semibold tracking-[-0.02em]">
              {s.myAnswer.correct ? (
                <>
                  Correct! <span className="font-mono tabular">+{s.myAnswer.points}</span>
                </>
              ) : (
                "Not this time."
              )}
            </p>
          ) : null}
          {s.status !== "live" && s.question.explanation ? <p className="mt-2 text-sm leading-relaxed text-muted">{s.question.explanation}</p> : null}
          {error ? <p role="alert" className="mt-2 text-sm text-danger">{error}</p> : null}
        </section>
      ) : null}
      {s.status === "ended" ? (
        <Card tone="inverse" className="mt-6 shadow-float">
          <HeroTexture />
          <p className="relative text-xl font-semibold leading-snug tracking-[-0.02em]">Game over! Chapter points were added for every correct answer.</p>
        </Card>
      ) : null}
      {s.isHost && s.status !== "ended" ? (
        <Button variant="accent" block size="lg" className="mt-6" disabled={pending} onClick={() => start(async () => { await advanceAction(s.id); await refresh(); })}>
          {s.status === "lobby" ? "Start game" : s.status === "live" ? "Reveal answer" : s.index + 1 >= s.total ? "Finish game" : "Next question"}
        </Button>
      ) : null}
      <section className="mt-10">
        <h2 className="eyebrow mb-3">
          Leaderboard · <span className="tabular">{s.players}</span> playing
        </h2>
        <ol className="divide-y divide-border overflow-hidden rounded-[24px] border border-border bg-card px-4 shadow-card sm:px-5">
          {s.board.length ? (
            s.board.map((b, i) => (
              <li key={i} className="flex items-center gap-4 py-3.5">
                <span className="w-7 shrink-0 font-mono text-sm text-muted tabular">{String(i + 1).padStart(2, "0")}</span>
                <span className={cn("min-w-0 flex-1 truncate", b.you && "font-semibold")}>
                  {b.name}
                  {b.you ? " (you)" : ""}
                </span>
                {b.you ? <span aria-hidden className="size-2 shrink-0 rounded-full bg-accent shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--fg)_25%,transparent)]" /> : null}
                <span className="shrink-0 font-mono font-medium tabular">{b.score}</span>
              </li>
            ))
          ) : (
            <li className="py-3.5 text-muted">No scores yet.</li>
          )}
        </ol>
      </section>
    </Page>
  );
}
