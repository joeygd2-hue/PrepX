"use client";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { BackHeader, Page } from "@/components/ui/page";
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
        <section className="rounded-3xl bg-fg p-8 text-center text-bg">
          <p className="text-2xl font-semibold">Get ready!</p>
          <p className="mt-2 opacity-80">{s.total} questions. Faster correct answers score more points.</p>
          {s.isHost ? null : <p className="mt-4 text-sm opacity-70">Waiting for the host to start…</p>}
        </section>
      ) : null}
      {s.question && s.status !== "lobby" ? (
        <section>
          <div className="mb-3 flex items-center justify-between text-sm text-muted">
            <span>
              Question {s.index + 1} of {s.total}
            </span>
            {s.secondsLeft !== null ? <span className="rounded-full bg-fg px-3 py-1 font-semibold text-bg tabular" role="timer">{s.secondsLeft}s</span> : null}
          </div>
          <h1 className="text-2xl font-semibold">{s.question.stem}</h1>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
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
                    "rounded-2xl border-2 p-4 text-left font-medium disabled:cursor-default",
                    s.status === "live" && mine && "border-fg bg-subtle",
                    s.status === "live" && !mine && "border-border hover:border-fg/50",
                    s.status !== "live" && right && "border-success bg-success/10",
                    s.status !== "live" && !right && mine && "border-danger bg-danger/10",
                    s.status !== "live" && !right && !mine && "border-border opacity-60",
                  )}
                >
                  <span className="mr-2 font-semibold">{LETTERS[i]}</span>
                  {c}
                  {s.counts ? <span className="float-right text-sm text-muted tabular">{s.counts[i]}</span> : null}
                </button>
              );
            })}
          </div>
          {s.status === "live" && (s.myAnswer || picked !== null) ? <p className="mt-3 text-sm text-muted">Answer locked in. Waiting for the reveal…</p> : null}
          {s.status !== "live" && s.myAnswer ? (
            <p className="mt-3 font-semibold">{s.myAnswer.correct ? `Correct! +${s.myAnswer.points}` : "Not this time."}</p>
          ) : null}
          {s.status !== "live" && s.question.explanation ? <p className="mt-2 text-sm text-muted">{s.question.explanation}</p> : null}
          {error ? <p role="alert" className="mt-2 text-sm text-danger">{error}</p> : null}
        </section>
      ) : null}
      {s.status === "ended" ? <p className="mt-6 text-xl font-semibold">Game over! Chapter points were added for every correct answer.</p> : null}
      {s.isHost && s.status !== "ended" ? (
        <Button block size="lg" className="mt-6" disabled={pending} onClick={() => start(async () => { await advanceAction(s.id); await refresh(); })}>
          {s.status === "lobby" ? "Start game" : s.status === "live" ? "Reveal answer" : s.index + 1 >= s.total ? "Finish game" : "Next question"}
        </Button>
      ) : null}
      <section className="mt-8">
        <h2 className="eyebrow mb-3">Leaderboard · {s.players} playing</h2>
        <ol className="divide-y divide-border rounded-3xl border border-border px-5">
          {s.board.length ? (
            s.board.map((b, i) => (
              <li key={i} className={cn("flex justify-between py-3", b.you && "font-semibold")}>
                <span>
                  {i + 1}. {b.name}
                  {b.you ? " (you)" : ""}
                </span>
                <span className="tabular">{b.score}</span>
              </li>
            ))
          ) : (
            <li className="py-3 text-muted">No scores yet.</li>
          )}
        </ol>
      </section>
    </Page>
  );
}
