"use client";

import { useEffect, useEffectEvent, useId, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Target, XCircle } from "lucide-react";
import { answerCheckAction, finishLessonAction } from "@/app/(app)/study/learn/[unitId]/actions";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, HeroTexture } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { Notice } from "@/components/ui/form";
import { Markdown } from "@/components/ui/markdown";
import { cn } from "@/lib/cn";
import type { CheckAnswer, CheckQuestion, ReaderPage, TermDef } from "./types";

const LETTERS = "ABCDEFGHIJ";
const SWIPE_MIN_PX = 56;

type Props = {
  unit: { id: string; title: string; objective: string; position: number };
  pages: ReaderPage[];
  /** Definitions for the term tokens in the page sources, by token index. */
  glossary: Record<number, TermDef>;
  unitTerms: TermDef[];
  minutes: number;
  questions: CheckQuestion[];
  complete: { correct: number; total: number } | null;
  practiceHref: string | null;
  next: { href: string; title: string } | null;
  courseHref: string;
};

type Finish = { status: "idle" } | { status: "done"; correct: number; total: number; xp: number } | { status: "error"; error: string };
type OpenTerm = { term: number; left: number; top: number; width: number };

function pageTitle(p: ReaderPage) {
  switch (p.kind) {
    case "intro":
      return "Introduction";
    case "lesson":
      return p.parts > 1 ? `Lesson, part ${p.part} of ${p.parts}` : "Lesson";
    case "practice":
      return "In practice";
    case "terms":
      return "Key terms";
    case "check":
      return "Check yourself";
    case "finish":
      return "Finish";
  }
}

const noSubscribe = () => () => {};

function readStoredPage(key: string): number | null {
  try {
    const v = window.localStorage.getItem(key);
    const n = v === null ? NaN : Number(v);
    return Number.isInteger(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Flip-through lesson reader: pages, key-term popovers, inline check questions and the finish step. */
export function CourseReader({ unit, pages, glossary, unitTerms, minutes, questions, complete, practiceHref, next, courseHref }: Props) {
  const storageKey = `prepx:course:${unit.id}:page`;
  const total = pages.length;
  const last = total - 1;
  const stored = useSyncExternalStore(noSubscribe, () => readStoredPage(storageKey), () => null);
  const [page, setPage] = useState<number | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  const [openTerm, setOpenTerm] = useState<OpenTerm | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [answers, setAnswers] = useState<Record<string, CheckAnswer>>(() => Object.fromEntries(questions.flatMap((q) => (q.answered ? [[q.id, q.answered]] : []))));
  const [checkError, setCheckError] = useState<string | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [answering, startAnswer] = useTransition();
  const [finish, setFinish] = useState<Finish>(complete ? { status: "done", ...complete, xp: 0 } : { status: "idle" });
  const [saving, startSaving] = useTransition();
  const readerRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const refocus = useRef(false);
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);
  const popoverId = useId();

  // Resume at the last page read. An unfinished lesson resumes before the finish page, which is
  // what marks it complete; a finished lesson left on its finish page opens at the start again.
  const done = finish.status === "done";
  const resume = stored === null || (done && stored >= last) ? 0 : Math.min(stored, done ? last : Math.max(0, last - 1));
  const current = Math.max(0, Math.min(page ?? resume, last));
  const currentPage = pages[current];
  const answeredCount = questions.filter((q) => answers[q.id]).length;
  const correctCount = questions.filter((q) => answers[q.id]?.correct).length;
  // Unanswered checks count as missed, so reaching the finish page with some left asks first.
  const unanswered = done ? 0 : questions.length - answeredCount;
  const checkPage = pages.findIndex((p) => p.kind === "check");

  // Page changes can remove or disable the focused control (Next on the last page, Previous on
  // the first, anything on the old page); keep keyboard focus in the reader when that happens.
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    const active = document.activeElement;
    if (!active || active === document.body) sectionRef.current?.focus({ preventScroll: true });
  }, [current]);

  function completeLesson() {
    if (finish.status === "done" || saving) return;
    startSaving(async () => {
      try {
        const r = await finishLessonAction(unit.id);
        setFinish(r.ok ? { status: "done", correct: r.correct, total: r.total, xp: r.xp } : { status: "error", error: r.error });
        setAnnouncement(r.ok ? (r.total ? `Lesson complete. You got ${r.correct} of ${r.total} on the checks.` : "Lesson complete.") : r.error);
      } catch {
        setFinish({ status: "error", error: "We couldn't save your progress. Check your connection and try again." });
      }
    });
  }

  function goTo(n: number) {
    const target = Math.max(0, Math.min(last, n));
    if (target === current) return;
    setDir(target > current ? 1 : -1);
    setPage(target);
    setOpenTerm(null);
    setAnnouncement(`Page ${target + 1} of ${total}: ${pageTitle(pages[target])}`);
    refocus.current = true;
    try {
      window.localStorage.setItem(storageKey, String(target));
    } catch {
      // Storage can be unavailable (private mode); resuming is a convenience.
    }
    if (pages[target].kind === "finish" && unanswered === 0) completeLesson();
    const el = readerRef.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }

  function answer(q: CheckQuestion, choice: number) {
    if (answering || answers[q.id]) return;
    setPendingQuestion(q.id);
    setCheckError(null);
    startAnswer(async () => {
      try {
        const r = await answerCheckAction(unit.id, q.id, choice);
        if (r.ok) {
          setAnswers((a) => ({ ...a, [q.id]: { chosen: choice, correct: r.correct, answerIndex: r.answerIndex, explanation: r.explanation } }));
          setAnnouncement(`${r.correct ? "Correct." : `Not quite. The answer is ${LETTERS[r.answerIndex]}.`} ${r.explanation}`);
        } else setCheckError(r.error);
      } catch {
        setCheckError("We couldn't check that answer. Try again.");
      }
      setPendingQuestion(null);
    });
  }

  function toggleTerm(term: number, button: HTMLElement) {
    if (openTerm?.term === term) {
      setOpenTerm(null);
      return;
    }
    const host = button.closest<HTMLElement>("[data-reader-page]");
    const def = glossary[term];
    if (!host || !def) return;
    const b = button.getBoundingClientRect();
    const h = host.getBoundingClientRect();
    const width = Math.min(300, h.width);
    setOpenTerm({ term, width, left: Math.max(0, Math.min(b.left - h.left, h.width - width)), top: b.bottom - h.top + 8 });
    setAnnouncement(`${def.term}: ${def.definition}`);
  }

  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key === "Escape" && openTerm) {
      const term = openTerm.term;
      setOpenTerm(null);
      readerRef.current?.querySelector<HTMLElement>(`[data-term-button="${term}"]`)?.focus();
      return;
    }
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest("input, textarea, select, [contenteditable='true'], [role='radio'], [role='slider'], [role='tab'], [role='menu'], [role='listbox'], dialog, [role='dialog'], [data-ask-ai-panel]")) return;
    e.preventDefault();
    goTo(current + (e.key === "ArrowRight" ? 1 : -1));
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKeyDown(e);
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const onOutsidePointer = useEffectEvent((e: PointerEvent) => {
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest("[data-term-popover], [data-term-button]")) return;
    setOpenTerm(null);
  });

  const termOpen = openTerm !== null;
  useEffect(() => {
    if (!termOpen) return;
    const handler = (e: PointerEvent) => onOutsidePointer(e);
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [termOpen]);

  const renderTerm = (term: number, text: string) => {
    if (!glossary[term]) return text;
    const open = openTerm?.term === term;
    return (
      <button
        type="button"
        data-term-button={term}
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        aria-describedby={open ? popoverId : undefined}
        onClick={(e) => toggleTerm(term, e.currentTarget)}
        className={cn(
          "rounded-[5px] px-0.5 underline decoration-accent decoration-2 underline-offset-[5px] transition-colors duration-200 hover:bg-accent/30",
          open ? "bg-accent/30" : "bg-accent/15",
        )}
      >
        {text}
      </button>
    );
  };

  const doneScore = finish.status === "done" ? finish : null;
  const nextLabel = currentPage.kind === "intro" ? "Start reading" : currentPage.kind === "check" || current === last - 1 ? "Finish lesson" : "Next";
  const confirmSkip = !doneScore && finish.status !== "error" && unanswered > 0 && !saving;

  function body() {
    switch (currentPage.kind) {
      case "intro":
        return (
          <>
            <p className="eyebrow">Unit {unit.position}</p>
            <h1 className="mt-3 text-[2rem] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-[2.35rem]">{unit.title}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Chip className="gap-1.5 tabular">
                <Clock className="size-3.5" aria-hidden />~{minutes} min read
              </Chip>
              <Chip className="tabular">{total} pages</Chip>
              {doneScore ? <Chip tone="accent">Lesson done</Chip> : null}
            </div>
            {unit.objective ? (
              <Card tone="subtle" className="mt-6 flex gap-3 p-4 text-[15px] leading-relaxed sm:p-5">
                <Target className="mt-0.5 size-[18px] shrink-0" aria-hidden />
                <p>
                  <span className="font-semibold">Learning objective: </span>
                  {unit.objective}
                </p>
              </Card>
            ) : null}
            {unitTerms.length ? (
              <div className="mt-7">
                <h2 className="eyebrow">Key terms in this unit</h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {unitTerms.slice(0, 8).map((t) => (
                    <li key={t.term} className="rounded-full border border-border bg-card px-3 py-1.5 text-sm">
                      {t.term}
                    </li>
                  ))}
                  {unitTerms.length > 8 ? <li className="px-1 py-1.5 text-sm text-muted">+{unitTerms.length - 8} more</li> : null}
                </ul>
              </div>
            ) : null}
            <p className="mt-7 text-sm leading-relaxed text-muted">Flip through with the buttons below, the ← and → keys, or a swipe. Tap a highlighted term to see what it means.</p>
          </>
        );
      case "lesson":
        return (
          <>
            <p className="eyebrow">{currentPage.parts > 1 ? `Lesson · Part ${currentPage.part} of ${currentPage.parts}` : "Lesson"}</p>
            <h2 className="mt-2 text-[1.35rem] font-semibold leading-tight tracking-[-0.02em]">{unit.title}</h2>
            <div className="mt-2 text-[17px]">
              <Markdown source={currentPage.source} renderTerm={renderTerm} />
            </div>
          </>
        );
      case "practice":
        return (
          <>
            <p className="eyebrow">In practice</p>
            <h2 className="mt-2 text-[1.35rem] font-semibold leading-tight tracking-[-0.02em]">How it shows up</h2>
            <Card className="mt-5 text-base">
              <Markdown source={currentPage.source} renderTerm={renderTerm} />
            </Card>
          </>
        );
      case "terms":
        return (
          <>
            <p className="eyebrow">Key terms</p>
            <h2 className="mt-2 text-[1.35rem] font-semibold leading-tight tracking-[-0.02em]">Words to know</h2>
            <dl className="mt-5 divide-y divide-border rounded-[24px] border border-border bg-card px-5 shadow-card">
              {unitTerms.map((t) => (
                <div key={t.term} className="py-4">
                  <dt className="font-semibold tracking-[-0.01em]">{t.term}</dt>
                  <dd className="mt-1 text-[15px] leading-relaxed text-muted">{t.definition}</dd>
                </div>
              ))}
            </dl>
          </>
        );
      case "check":
        return (
          <>
            <p className="eyebrow">Check yourself</p>
            <h2 className="mt-2 text-[1.35rem] font-semibold leading-tight tracking-[-0.02em]">Quick check</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              {doneScore ? "Your lesson score is saved. Answering again here is just for review." : "Answer each question to see the explanation. Your score is saved when you finish the lesson."}
            </p>
            <ol className="mt-6 space-y-4">
              {questions.map((q, qi) => {
                const a = answers[q.id];
                const stemId = `${popoverId}-q${qi}`;
                return (
                  <li key={q.id}>
                    <Card aria-busy={pendingQuestion === q.id}>
                      <p className="eyebrow tabular">
                        Question {qi + 1} of {questions.length}
                      </p>
                      <p id={stemId} className="mt-2 text-[17px] font-semibold leading-snug tracking-[-0.01em]">
                        {q.stem}
                      </p>
                      <div role="group" aria-labelledby={stemId} className="mt-4 space-y-2.5">
                        {q.choices.map((c, i) => {
                          const tone = a ? (i === a.answerIndex ? "right" : i === a.chosen ? "wrong" : "dim") : "idle";
                          return (
                            <button
                              key={i}
                              type="button"
                              disabled={Boolean(a) || answering}
                              aria-pressed={a ? i === a.chosen : undefined}
                              onClick={() => answer(q, i)}
                              className={cn(
                                "group/choice flex w-full items-start gap-3 rounded-[16px] border p-3.5 text-left transition-[border-color,background-color,color] duration-200 disabled:cursor-default",
                                tone === "idle" && "border-border bg-card hover:border-border-strong",
                                tone === "right" && "border-success bg-success/10",
                                tone === "wrong" && "border-danger bg-danger/10",
                                tone === "dim" && "border-border bg-card/60 text-muted",
                              )}
                            >
                              <span
                                aria-hidden
                                className={cn(
                                  "inline-flex size-8 shrink-0 items-center justify-center rounded-[10px] border font-mono text-[13px] font-semibold",
                                  tone === "idle" && "border-border-strong bg-subtle/70 text-muted group-hover/choice:border-fg group-hover/choice:text-fg",
                                  tone === "right" && "border-success/40 bg-success/15 text-success",
                                  tone === "wrong" && "border-danger/40 bg-danger/15 text-danger",
                                  tone === "dim" && "border-border",
                                )}
                              >
                                {LETTERS[i]}
                              </span>
                              <span className="min-w-0 flex-1 pt-1 text-[15px] leading-relaxed">{c}</span>
                              {tone === "right" ? <CheckCircle2 className="pop-in mt-1.5 size-5 shrink-0 text-success" aria-label="Correct answer" /> : null}
                              {tone === "wrong" ? <XCircle className="pop-in mt-1.5 size-5 shrink-0 text-danger" aria-label="Your answer" /> : null}
                            </button>
                          );
                        })}
                      </div>
                      {a ? (
                        <div className={cn("mt-4 rounded-[16px] border p-4", a.correct ? "border-success/25 bg-success/10" : "border-danger/25 bg-danger/10")}>
                          <p className={cn("flex items-center gap-2 font-semibold tracking-[-0.01em]", a.correct ? "text-success" : "text-danger")}>
                            {a.correct ? <CheckCircle2 className="size-[18px] shrink-0" aria-hidden /> : <XCircle className="size-[18px] shrink-0" aria-hidden />}
                            {a.correct ? "Correct" : `Not quite. The answer is ${LETTERS[a.answerIndex]}.`}
                          </p>
                          <p className="mt-2 text-[15px] leading-relaxed">{a.explanation}</p>
                        </div>
                      ) : null}
                    </Card>
                  </li>
                );
              })}
            </ol>
            {checkError ? (
              <Notice tone="error" className="mt-4">
                {checkError}
              </Notice>
            ) : null}
            <p className="mt-4 text-sm text-muted tabular">
              {answeredCount} of {questions.length} answered{answeredCount ? ` · ${correctCount} correct` : ""}
            </p>
          </>
        );
      case "finish":
        return (
          <Card tone="inverse" className="p-6 shadow-float sm:p-8">
            <HeroTexture />
            <div className="relative">
              <p className="eyebrow !text-hero-muted">Unit {unit.position} · Finish</p>
              <h2 className="mt-5 text-[1.75rem] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[2rem]">
                {doneScore ? "Lesson complete" : finish.status === "error" ? "Almost there" : confirmSkip ? "Finish the quick check?" : "Saving your progress…"}
              </h2>
              {doneScore ? (
                <>
                  <p className="mt-3 max-w-md text-hero-muted">
                    {doneScore.total ? `You got ${doneScore.correct} of ${doneScore.total} on the checks.` : "You finished the reading."}
                    {doneScore.xp ? ` +${doneScore.xp} XP.` : ""} Keep practicing this unit to master it: 80% on your last 15+ questions.
                  </p>
                  {doneScore.total ? (
                    <div className="mt-5 flex max-w-48 gap-1.5" aria-hidden>
                      {Array.from({ length: doneScore.total }, (_, n) => (
                        <span key={n} className={cn("h-1.5 flex-1 rounded-full", n < doneScore.correct ? "bg-accent" : "bg-hero-line")} />
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    {practiceHref ? (
                      <ButtonLink href={practiceHref} variant="accent">
                        Practice this unit <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-0.5" aria-hidden />
                      </ButtonLink>
                    ) : null}
                    <ButtonLink href={next?.href ?? courseHref} variant="hero" className="min-w-0">
                      <span className="truncate">{next ? `Next lesson: ${next.title}` : "Back to the course"}</span>
                      <ArrowRight className="size-4 shrink-0 transition-transform group-hover/btn:translate-x-0.5" aria-hidden />
                    </ButtonLink>
                  </div>
                </>
              ) : finish.status === "error" ? (
                <>
                  <p className="mt-3 max-w-md text-hero-muted" role="alert">
                    {finish.error}
                  </p>
                  <Button variant="hero" className="mt-6" onClick={completeLesson} disabled={saving}>
                    Try again
                  </Button>
                </>
              ) : confirmSkip ? (
                <>
                  <p className="mt-3 max-w-md text-hero-muted">
                    {unanswered === questions.length
                      ? `You haven't answered the ${questions.length === 1 ? "check question" : `${questions.length} check questions`} yet.`
                      : `${unanswered} of ${questions.length} check questions ${unanswered === 1 ? "is" : "are"} still unanswered.`}{" "}
                    Skipped questions count as missed.
                  </p>
                  <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                    {checkPage >= 0 ? (
                      <Button variant="accent" onClick={() => goTo(checkPage)}>
                        <ArrowLeft className="size-4" aria-hidden /> Answer the questions
                      </Button>
                    ) : null}
                    <Button variant="hero" onClick={completeLesson}>
                      Finish anyway
                    </Button>
                  </div>
                </>
              ) : (
                <p className="mt-3 text-hero-muted" role="status">
                  Marking this lesson complete.
                </p>
              )}
            </div>
          </Card>
        );
    }
  }

  const def = openTerm ? glossary[openTerm.term] : undefined;

  return (
    <div ref={readerRef} className="scroll-mt-6">
      {currentPage.kind !== "intro" ? <h1 className="sr-only">{unit.title}</h1> : null}
      <div className="mb-7 flex items-center gap-3">
        <div
          role="progressbar"
          aria-label="Lesson progress"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={current + 1}
          aria-valuetext={`Page ${current + 1} of ${total}`}
          className="flex flex-1 gap-1"
        >
          {pages.map((_, i) => (
            <span key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors duration-300", i <= current ? "bg-fg" : "bg-subtle-2")} />
          ))}
        </div>
        <p aria-hidden className="shrink-0 font-mono text-sm font-medium text-muted tabular">
          {current + 1} / {total}
        </p>
      </div>
      <div
        className="touch-pan-y touch-pinch-zoom overflow-x-clip"
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" || (e.target instanceof Element && e.target.closest("button, a, input, textarea, select, [data-term-popover]"))) return;
          swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
        }}
        onPointerUp={(e) => {
          const s = swipe.current;
          swipe.current = null;
          if (!s || s.id !== e.pointerId) return;
          const dx = e.clientX - s.x;
          const dy = e.clientY - s.y;
          if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
          if (window.getSelection()?.toString()) return;
          goTo(current + (dx < 0 ? 1 : -1));
        }}
        onPointerCancel={() => {
          swipe.current = null;
        }}
      >
        <section
          key={current}
          ref={sectionRef}
          tabIndex={-1}
          data-reader-page
          aria-label={`Page ${current + 1} of ${total}`}
          className={cn(
            "relative pb-1 outline-none transition-[opacity,translate] duration-300 ease-out starting:opacity-0 motion-reduce:transition-none",
            dir > 0 ? "starting:translate-x-8" : "starting:-translate-x-8",
          )}
        >
          {body()}
          {openTerm && def ? (
            <div
              id={popoverId}
              role="tooltip"
              data-term-popover
              className="absolute z-20 rounded-[16px] border border-border bg-card p-4 shadow-float transition-[opacity,translate] duration-200 starting:-translate-y-1 starting:opacity-0 motion-reduce:transition-none"
              style={{ left: openTerm.left, top: openTerm.top, width: openTerm.width }}
            >
              <p className="text-[15px] font-semibold tracking-[-0.01em]">{def.term}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{def.definition}</p>
            </div>
          ) : null}
        </section>
      </div>
      <nav aria-label="Lesson pages" className="mt-10 flex items-center justify-between gap-3 border-t border-border pt-5">
        <Button variant="outline" onClick={() => goTo(current - 1)} disabled={current === 0} className="px-4 sm:px-5">
          <ArrowLeft className="size-4 transition-transform group-hover/btn:-translate-x-0.5" aria-hidden />
          <span className="sr-only sm:not-sr-only">Previous</span>
        </Button>
        {current < last ? (
          <Button variant={currentPage.kind === "intro" ? "accent" : "primary"} onClick={() => goTo(current + 1)}>
            {nextLabel} <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-0.5" aria-hidden />
          </Button>
        ) : null}
      </nav>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
