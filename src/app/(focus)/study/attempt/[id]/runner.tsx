"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Flag, Loader2, Timer, X, XCircle } from "lucide-react";
import { answerAction, saveDraftAction, submitAction } from "@/app/actions/exam";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { cn } from "@/lib/cn";
import { BookmarkControls } from "@/app/(app)/study/bookmarks/bookmark-controls";

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
  /** Bookmarked questions of this attempt: question id → private note. */
  bookmarks: Record<string, string>;
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
  const [marks, setMarks] = useState(props.bookmarks);
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
      // Bookmark and note controls handle their own keys (Enter on them must not skip ahead).
      if (e.target instanceof Element && e.target.closest("[data-bookmark]")) return;
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

  const urgent = remaining !== null && remaining <= 60;
  const last = index + 1 >= questions.length;
  // Ask AI stays off during timed attempts, and elsewhere until the current question is answered.
  const askOff = mode === "full" || mode === "rehearsal" || sprint || !fb;

  return (
    <main id="main" data-ask-ai={askOff ? "off" : undefined} className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 pb-[max(env(safe-area-inset-bottom),2rem)] pt-5 sm:px-6 sm:pt-8">
      <header className="flex items-center gap-3">
        <Link
          href="/study"
          aria-label={props.allowPause ? "Save and exit" : "Exit (the clock keeps running)"}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-[12px] border border-border bg-card shadow-card transition-colors hover:border-border-strong"
          onClick={() => !instant && void saveDraftAction(attemptId, draft, elapsed.current)}
        >
          <X className="size-[18px]" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight tracking-[-0.01em]">{props.label}</p>
          <p className="mt-1 font-mono text-xs text-muted tabular">
            {sprint ? `${sprintScore} correct` : `Question ${index + 1} of ${questions.length}`}
          </p>
        </div>
        {mm ? (
          <p
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 font-mono text-sm font-medium tabular transition-colors duration-500",
              // Sprints run on a 60-second clock, so only their final seconds read as urgent.
              remaining !== null && remaining <= (sprint ? 10 : 60) ? "border-danger/30 bg-danger/10 text-danger" : "border-border bg-card shadow-card",
            )}
            role="timer"
            aria-live={urgent ? "polite" : "off"}
          >
            <Timer className="size-4 opacity-60" aria-hidden />
            {mm}
          </p>
        ) : null}
      </header>
      <ProgressBar value={sprint ? 60 - (remaining ?? 0) : answeredCount} max={sprint ? 60 : questions.length} className="mt-5" label="Progress" />

      <section aria-labelledby="stem" className="mt-9 flex-1 sm:mt-12">
        {q.source === "ai_generated" ? (
          <Chip tone="warning" className="mb-4">
            AI-generated practice question
          </Chip>
        ) : null}
        <h1 id="stem" className="text-[1.35rem] font-semibold leading-[1.3] tracking-[-0.02em] sm:text-[1.6rem]">
          {q.stem}
        </h1>
        <div role="radiogroup" aria-labelledby="stem" className="mt-7 space-y-2.5">
          {q.choices.map((c, i) => {
            const isSel = selected === i;
            const isRight = fb && i === fb.answerIndex;
            const isWrong = fb && isSel && !fb.correct;
            const tone = fb && !sprint ? (isRight ? "right" : isWrong ? "wrong" : "dim") : isSel ? "selected" : fb ? "dim" : "idle";
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={isSel}
                disabled={pending || (instant && Boolean(fb))}
                onClick={() => choose(i)}
                className={cn(
                  "group/choice flex w-full items-start gap-3.5 rounded-[16px] border p-4 text-left transition-[border-color,background-color,box-shadow,color] duration-200 disabled:cursor-default",
                  tone === "idle" && "border-border bg-card shadow-card hover:border-border-strong",
                  tone === "selected" && "border-fg bg-card shadow-card ring-4 ring-accent/30",
                  tone === "right" && "border-success bg-success/10",
                  tone === "wrong" && "border-danger bg-danger/10",
                  tone === "dim" && "border-border bg-card/60 text-muted",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "inline-flex size-8 shrink-0 items-center justify-center rounded-[10px] border font-mono text-[13px] font-semibold transition-colors duration-200",
                    tone === "idle" && "border-border-strong bg-subtle/70 text-muted group-hover/choice:border-fg group-hover/choice:text-fg",
                    tone === "selected" && "border-primary bg-primary text-primary-fg",
                    tone === "right" && "border-success/40 bg-success/15 text-success",
                    tone === "wrong" && "border-danger/40 bg-danger/15 text-danger",
                    tone === "dim" && "border-border",
                  )}
                >
                  {LETTERS[i]}
                </span>
                <span className="min-w-0 flex-1 pt-1 text-[15px] leading-relaxed sm:text-base">{c}</span>
                {tone === "right" ? <CheckCircle2 className="pop-in mt-1.5 size-5 shrink-0 text-success" aria-label="Correct answer" /> : null}
                {tone === "wrong" ? <XCircle className="pop-in mt-1.5 size-5 shrink-0 text-danger" aria-label="Your answer" /> : null}
              </button>
            );
          })}
        </div>
        {fb && !sprint ? (
          <div role="status" className={cn("mt-5 rounded-[16px] border p-4 sm:p-5", fb.correct ? "border-success/25 bg-success/10" : "border-danger/25 bg-danger/10")}>
            <p className={cn("flex items-center gap-2 font-semibold tracking-[-0.01em]", fb.correct ? "text-success" : "text-danger")}>
              {fb.correct ? <CheckCircle2 className="size-[18px] shrink-0" aria-hidden /> : <XCircle className="size-[18px] shrink-0" aria-hidden />}
              {fb.correct ? "Correct" : `Not quite. The answer is ${LETTERS[fb.answerIndex]}.`}
            </p>
            <p className="mt-2 text-[15px] leading-relaxed">{fb.explanation}</p>
          </div>
        ) : null}
        {fb && !sprint ? (
          <BookmarkControls
            key={q.id}
            questionId={q.id}
            initial={{ bookmarked: q.id in marks, note: marks[q.id] ?? "" }}
            onChange={(v) =>
              setMarks((m) => {
                const n = { ...m };
                if (v.bookmarked) n[q.id] = v.note;
                else delete n[q.id];
                return n;
              })
            }
          />
        ) : null}
        {error ? <p role="alert" className="mt-4 text-sm text-danger">{error}</p> : null}
      </section>

      {/* One wrapper so controls that come and go (and the dialog) don't replay the page entrance. */}
      <div className="mt-8">
        {!sprint ? (
          <div className="flex items-center gap-2.5">
            {!instant ? (
              <>
                <Button variant="outline" size="lg" aria-label="Previous question" className="w-14 shrink-0 px-0" disabled={index === 0} onClick={() => setIndex(index - 1)}>
                  <ChevronLeft className="size-5" aria-hidden />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  aria-pressed={flags.has(q.id)}
                  className={cn("w-14 shrink-0 px-0 sm:w-auto sm:px-5", flags.has(q.id) && "border-warning/40 bg-warning/10 text-warning hover:border-warning/60 hover:bg-warning/15")}
                  onClick={() => setFlags((f) => { const n = new Set(f); if (n.has(q.id)) n.delete(q.id); else n.add(q.id); return n; })}
                >
                  <Flag className={cn("size-4", flags.has(q.id) && "fill-current")} aria-hidden /> <span className="sr-only sm:not-sr-only">{flags.has(q.id) ? "Flagged" : "Flag"}</span>
                </Button>
              </>
            ) : null}
            <Button variant={last ? "accent" : "primary"} className="min-w-0 flex-1" size="lg" disabled={pending || (instant && !fb)} onClick={next}>
              {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
              {index + 1 < questions.length ? "Next" : instant ? "See results" : "Review & submit"} <ChevronRight className="size-5 transition-transform group-hover/btn:translate-x-0.5" aria-hidden />
            </Button>
          </div>
        ) : null}

        {!instant ? (
          <nav aria-label="Question navigator" className="mt-8">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-1.5">
              {questions.map((qq, i) => (
                <button
                  key={qq.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Question ${i + 1}${draft[qq.id] !== undefined ? ", answered" : ""}${flags.has(qq.id) ? ", flagged" : ""}`}
                  aria-current={i === index}
                  className={cn(
                    "relative h-9 rounded-[10px] font-mono text-xs font-medium tabular transition-colors",
                    i === index ? "bg-primary text-primary-fg" : draft[qq.id] !== undefined ? "bg-subtle-2 text-fg" : "border border-border bg-card text-muted hover:border-border-strong hover:text-fg",
                  )}
                >
                  {i + 1}
                  {flags.has(qq.id) ? <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-warning ring-2 ring-bg" aria-hidden /> : null}
                </button>
              ))}
            </div>
          </nav>
        ) : null}

        {!instant && index + 1 < questions.length ? (
          <div className="mt-5 flex justify-center">
            <Button variant="ghost" size="sm" className="text-muted hover:text-fg" onClick={() => setConfirming(true)}>
              Submit exam
            </Button>
          </div>
        ) : null}

        {confirming ? (
          <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="fixed inset-0 z-50 flex items-end justify-center bg-hero/50 p-4 backdrop-blur-sm sm:items-center">
            <div className="w-full max-w-md rounded-[24px] border border-border bg-card p-6 shadow-float">
              <h2 id="confirm-title" className="text-xl font-semibold tracking-[-0.02em]">
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
                <Button variant="accent" className="flex-1" disabled={pending} onClick={submit}>
                  {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Submit
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
