"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Flag, Loader2, X, XCircle } from "lucide-react";
import { answerAction, saveDraftAction, submitAction } from "@/app/actions/exam";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress";
import { cn } from "@/lib/cn";

type Q = {
  id: string;
  stem: string;
  choices: string[];
  source: string;
  answered: { chosen: number | null; correct: boolean; answerIndex: number; explanation: string } | null;
};
type Feedback = { chosen: number; correct: boolean; answerIndex: number; explanation: string };
const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function ExamRunner(props: {
  attemptId: string;
  mode: string;
  label: string;
  instant: boolean;
  allowPause: boolean;
  questions: Q[];
  initialDraft: Record<string, number>;
  remainingSec: number | null;
  elapsedSec: number;
}) {
  const { attemptId, mode, instant, questions } = props;
  const sprint = mode === "sprint";
  const firstOpen = instant ? Math.max(0, questions.findIndex((q) => !q.answered)) : 0;
  const [index, setIndex] = useState(firstOpen === -1 ? 0 : firstOpen);
  const [draft, setDraft] = useState<Record<string, number>>(props.initialDraft);
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<Record<string, Feedback>>(() =>
    Object.fromEntries(questions.filter((q) => q.answered).map((q) => [q.id, { chosen: q.answered!.chosen ?? -1, correct: q.answered!.correct, answerIndex: q.answered!.answerIndex, explanation: q.answered!.explanation }])),
  );
  const [remaining, setRemaining] = useState(props.remainingSec);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const elapsed = useRef(props.elapsedSec);
  const submitted = useRef(false);
  const q = questions[index];
  const sprintScore = useMemo(() => Object.values(feedback).filter((f) => f.correct).length, [feedback]);

  const submit = useCallback(() => {
    if (submitted.current) return;
    submitted.current = true;
    start(() => submitAction(attemptId, instant ? undefined : draft, elapsed.current));
  }, [attemptId, draft, instant]);

  // Timer
  useEffect(() => {
    if (remaining === null) return;
    if (remaining <= 0) {
      submit();
      return;
    }
    const t = setTimeout(() => {
      elapsed.current += 1;
      setRemaining((r) => (r === null ? r : r - 1));
    }, 1000);
    return () => clearTimeout(t);
  }, [remaining, submit]);

  // Autosave exam drafts (debounced) so progress survives a closed tab.
  useEffect(() => {
    if (instant) return;
    const t = setTimeout(() => void saveDraftAction(attemptId, draft, elapsed.current), 800);
    return () => clearTimeout(t);
  }, [draft, attemptId, instant]);
  useEffect(() => {
    if (instant || !props.allowPause) return;
    const i = setInterval(() => void saveDraftAction(attemptId, draft, elapsed.current), 15000);
    return () => clearInterval(i);
  }, [attemptId, draft, instant, props.allowPause]);

  const choose = useCallback(
    (choice: number) => {
      if (!q || submitted.current) return;
      if (!instant) {
        setDraft((d) => ({ ...d, [q.id]: choice }));
        return;
      }
      if (feedback[q.id]) return;
      start(async () => {
        const r = await answerAction(attemptId, q.id, choice);
        if (!r.ok) {
          setError(r.error);
          if (sprint) submit();
          return;
        }
        setFeedback((f) => ({ ...f, [q.id]: { chosen: choice, correct: r.correct, answerIndex: r.answerIndex, explanation: r.explanation } }));
        if (sprint) {
          if (index + 1 < questions.length) setTimeout(() => setIndex((i) => i + 1), 250);
          else submit();
        }
      });
    },
    [q, instant, feedback, attemptId, sprint, index, questions.length, submit],
  );

  const next = useCallback(() => {
    if (index + 1 < questions.length) setIndex(index + 1);
    else if (instant) submit();
    else setConfirming(true);
  }, [index, questions.length, instant, submit]);

  // Keyboard: 1-4 / A-D choose, Enter or → next, ← previous.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || confirming) return;
      const k = e.key.toUpperCase();
      const n = "1234".indexOf(k) >= 0 ? "1234".indexOf(k) : "ABCD".indexOf(k);
      if (n >= 0 && q && n < q.choices.length) choose(n);
      else if ((e.key === "Enter" || e.key === "ArrowRight") && (!instant || feedback[q?.id ?? ""])) next();
      else if (e.key === "ArrowLeft" && !instant && index > 0) setIndex(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choose, next, q, instant, feedback, index, confirming]);

  if (!q) return null;
  const fb = feedback[q.id];
  const selected = instant ? fb?.chosen : draft[q.id];
  const answeredCount = instant ? Object.keys(feedback).length : Object.keys(draft).length;
  const mm = remaining !== null ? `${Math.floor(Math.max(remaining, 0) / 60)}:${String(Math.max(remaining, 0) % 60).padStart(2, "0")}` : null;

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 pb-8 pt-5 sm:px-6">
      <header className="flex items-center gap-3">
        <Link
          href="/study"
          aria-label={props.allowPause ? "Save and exit" : "Exit (the clock keeps running)"}
          className="inline-flex size-11 items-center justify-center rounded-full bg-subtle hover:bg-subtle-2"
          onClick={() => !instant && void saveDraftAction(attemptId, draft, elapsed.current)}
        >
          <X className="size-5" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{props.label}</p>
          <p className="text-sm text-muted tabular">
            {sprint ? `${sprintScore} correct` : `Question ${index + 1} of ${questions.length}`}
          </p>
        </div>
        {mm ? (
          <p className={cn("rounded-full px-3 py-1.5 font-semibold tabular", remaining !== null && remaining <= 60 ? "bg-danger text-white" : "bg-subtle")} role="timer" aria-live={remaining !== null && remaining <= 60 ? "polite" : "off"}>
            {mm}
          </p>
        ) : null}
      </header>
      <ProgressBar value={sprint ? 60 - (remaining ?? 0) : answeredCount} max={sprint ? 60 : questions.length} className="mt-4" label="Progress" />

      <section aria-labelledby="stem" className="mt-8 flex-1">
        {q.source === "ai_generated" ? <p className="mb-2 text-xs font-medium text-warning">AI-generated practice question</p> : null}
        <h1 id="stem" className="text-xl font-semibold leading-snug sm:text-2xl">
          {q.stem}
        </h1>
        <div role="radiogroup" aria-labelledby="stem" className="mt-6 space-y-3">
          {q.choices.map((c, i) => {
            const isSel = selected === i;
            const isRight = fb && i === fb.answerIndex;
            const isWrong = fb && isSel && !fb.correct;
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={isSel}
                disabled={pending || (instant && Boolean(fb))}
                onClick={() => choose(i)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl border-2 p-4 text-left transition-colors disabled:cursor-default",
                  !fb && isSel && "border-fg bg-subtle",
                  !fb && !isSel && "border-border hover:border-fg/40",
                  isRight && !sprint && "border-success bg-success/10",
                  isWrong && !sprint && "border-danger bg-danger/10",
                  fb && !isRight && !isWrong && "border-border opacity-70",
                )}
              >
                <span className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold", isSel ? "border-fg bg-fg text-bg" : "border-border")}>{LETTERS[i]}</span>
                <span className="pt-0.5">{c}</span>
                {isRight && !sprint ? <CheckCircle2 className="ml-auto size-5 shrink-0 text-success" aria-label="Correct answer" /> : null}
                {isWrong && !sprint ? <XCircle className="ml-auto size-5 shrink-0 text-danger" aria-label="Your answer" /> : null}
              </button>
            );
          })}
        </div>
        {fb && !sprint ? (
          <div role="status" className={cn("mt-5 rounded-2xl p-4", fb.correct ? "bg-success/10" : "bg-danger/10")}>
            <p className="font-semibold">{fb.correct ? "Correct" : `Not quite. The answer is ${LETTERS[fb.answerIndex]}.`}</p>
            <p className="mt-1 text-sm">{fb.explanation}</p>
          </div>
        ) : null}
        {error ? <p role="alert" className="mt-4 text-sm text-danger">{error}</p> : null}
      </section>

      {!instant ? (
        <nav aria-label="Question navigator" className="mt-8">
          <div className="flex flex-wrap gap-1.5">
            {questions.map((qq, i) => (
              <button
                key={qq.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Question ${i + 1}${draft[qq.id] !== undefined ? ", answered" : ""}${flags.has(qq.id) ? ", flagged" : ""}`}
                aria-current={i === index}
                className={cn(
                  "relative size-9 rounded-lg text-xs font-semibold tabular",
                  i === index ? "bg-fg text-bg" : draft[qq.id] !== undefined ? "bg-subtle-2" : "border border-border",
                )}
              >
                {i + 1}
                {flags.has(qq.id) ? <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-warning" aria-hidden /> : null}
              </button>
            ))}
          </div>
        </nav>
      ) : null}

      {!sprint ? (
        <div className="mt-6 flex items-center gap-3">
          {!instant ? (
            <>
              <Button variant="subtle" aria-label="Previous question" disabled={index === 0} onClick={() => setIndex(index - 1)}>
                <ChevronLeft className="size-5" aria-hidden />
              </Button>
              <Button
                variant="subtle"
                aria-pressed={flags.has(q.id)}
                onClick={() => setFlags((f) => { const n = new Set(f); if (n.has(q.id)) n.delete(q.id); else n.add(q.id); return n; })}
              >
                <Flag className="size-4" aria-hidden /> {flags.has(q.id) ? "Flagged" : "Flag"}
              </Button>
            </>
          ) : null}
          <Button className="flex-1" size="lg" disabled={pending || (instant && !fb)} onClick={next}>
            {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
            {index + 1 < questions.length ? "Next" : instant ? "See results" : "Review & submit"} <ChevronRight className="size-5" aria-hidden />
          </Button>
        </div>
      ) : null}
      {!instant && index + 1 < questions.length ? (
        <button type="button" className="mt-4 text-center text-sm font-medium underline-offset-2 hover:underline" onClick={() => setConfirming(true)}>
          Submit exam
        </button>
      ) : null}

      {confirming ? (
        <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl bg-bg p-6">
            <h2 id="confirm-title" className="text-xl font-semibold">
              Submit your exam?
            </h2>
            <p className="mt-2 text-muted">
              {questions.length - answeredCount > 0 ? `${questions.length - answeredCount} question${questions.length - answeredCount === 1 ? " is" : "s are"} unanswered and will be marked incorrect.` : "All questions answered."}
              {flags.size ? ` ${flags.size} flagged for review.` : ""}
            </p>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setConfirming(false)}>
                Keep working
              </Button>
              <Button className="flex-1" disabled={pending} onClick={submit}>
                {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Submit
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
