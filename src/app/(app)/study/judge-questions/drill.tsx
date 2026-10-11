"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, HeroTexture } from "@/components/ui/card";
import { Notice } from "@/components/ui/form";
import { ProgressBar } from "@/components/ui/progress";
import { SpeechInput } from "@/components/app/speech-input";
import { answerJudgeQuestion, startJudgeQuestions } from "@/app/actions/ai";
import { cn } from "@/lib/cn";

type A = { answer: string; rating: number; feedback: string; strongerAnswer: string };

export function QuestionsDrill(props: { sessionId: string | null; questions: string[]; answers: Record<string, A>; closed: boolean; remaining: number | null; resets: string }) {
  const router = useRouter();
  const [answers, setAnswers] = useState(props.answers);
  const [index, setIndex] = useState(() => Math.max(0, props.questions.findIndex((_, i) => !props.answers[i])));
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const generate = () =>
    start(async () => {
      setError(null);
      const r = await startJudgeQuestions();
      if (!r.ok) setError(r.error);
      else router.refresh();
    });

  if (!props.sessionId || !props.questions.length)
    return (
      <Card tone="inverse" className="rounded-[28px] p-6 shadow-float sm:p-8">
        <HeroTexture />
        <div className="relative">
          <p className="text-[1.6rem] font-semibold leading-[1.15] tracking-[-0.03em] sm:text-[1.85rem]">
            Get 20 questions a judge is likely to ask about your event. <span className="text-hero-muted">Answer each out loud and get quick feedback.</span>
          </p>
          <p className="mt-6 text-sm text-hero-muted">
            {props.remaining === null ? (
              "Unlimited sets."
            ) : (
              <>
                <span className="font-mono font-medium text-hero-fg tabular">{props.remaining}</span> set{props.remaining === 1 ? "" : "s"} left today. {props.resets}.
              </>
            )}
          </p>
          <Button block size="lg" variant="accent" className="mt-4" disabled={pending || props.remaining === 0} onClick={generate}>
            {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null} Generate my questions
          </Button>
          {error ? (
            <p role="alert" className="mt-4 rounded-[14px] border border-danger/40 bg-danger/15 px-4 py-3 text-sm text-hero-fg">
              {error}
            </p>
          ) : null}
        </div>
      </Card>
    );

  const q = props.questions[index];
  const a = answers[index];
  const done = Object.keys(answers).length;
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-xs text-muted tabular">
            Question {index + 1} of {props.questions.length} · {done} answered
          </p>
          <Button variant="ghost" size="sm" onClick={generate} disabled={pending || props.remaining === 0} className="-mr-2 shrink-0 text-muted hover:text-fg">
            <RefreshCw className="size-4" aria-hidden /> New set
          </Button>
        </div>
        <ProgressBar value={done} max={props.questions.length} label="Questions answered" className="mt-3" />
      </div>
      <Card tone="inverse" className="rounded-[28px] p-6 shadow-float sm:p-8">
        <HeroTexture />
        <div className="relative">
          <p className="eyebrow !text-hero-muted">The judge asks</p>
          <p className="mt-4 text-[1.4rem] font-semibold leading-snug tracking-[-0.025em] text-balance break-words sm:text-[1.65rem]">{q}</p>
        </div>
      </Card>
      {a ? (
        <Card aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold tracking-[-0.01em]">
              Practice rating: <span className="font-mono tabular">{a.rating}/5</span>
            </p>
            <span className="flex items-center gap-1" aria-hidden>
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className={cn("h-1.5 w-4 rounded-full sm:w-5", n <= a.rating ? "bg-accent shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--fg)_18%,transparent)]" : "bg-subtle-2")} />
              ))}
            </span>
          </div>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">{a.feedback}</p>
          <p className="mt-4 rounded-[16px] bg-subtle/70 p-4 text-sm leading-relaxed">
            <span className="font-semibold">A stronger answer: </span>
            {a.strongerAnswer}
          </p>
          <details className="group mt-4 text-sm text-muted">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-[8px] font-medium transition-colors hover:text-fg [&::-webkit-details-marker]:hidden">
              Your answer
              <ChevronDown className="size-4 transition-transform duration-200 group-open:rotate-180" aria-hidden />
            </summary>
            <p className="mt-2 whitespace-pre-wrap leading-relaxed">{a.answer}</p>
          </details>
        </Card>
      ) : props.closed ? (
        <Notice tone="warning">This set is more than a day old, so feedback has closed. Generate a new set to keep practicing.</Notice>
      ) : (
        <>
          <SpeechInput value={draft} onChange={setDraft} label="Your answer" rows={5} placeholder="Answer as you would to the judge…" />
          <Button
            block
            size="lg"
            variant="accent"
            disabled={pending || !draft.trim()}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await answerJudgeQuestion(props.sessionId!, index, draft);
                if (!r.ok) setError(r.error);
                else {
                  setAnswers({ ...answers, [index]: { answer: draft, ...r.data! } });
                  setDraft("");
                }
              })
            }
          >
            {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null} Get feedback
          </Button>
        </>
      )}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" disabled={index === 0} onClick={() => { setIndex(index - 1); setDraft(""); }}>
          <ChevronLeft className="size-4" aria-hidden /> Previous
        </Button>
        <Button variant="outline" className="flex-1" disabled={index + 1 >= props.questions.length} onClick={() => { setIndex(index + 1); setDraft(""); }}>
          Next question <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
      <p className="text-xs text-muted">AI-generated practice questions. Real judges may ask different questions.</p>
    </div>
  );
}
