"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SpeechInput } from "@/components/app/speech-input";
import { answerJudgeQuestion, startJudgeQuestions } from "@/app/actions/ai";

type A = { answer: string; rating: number; feedback: string; strongerAnswer: string };

export function QuestionsDrill(props: { sessionId: string | null; questions: string[]; answers: Record<string, A>; remaining: number | null; resets: string }) {
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
      <div className="space-y-3">
        <p className="text-muted">Get 20 questions a judge is likely to ask about your event. Answer each out loud and get quick feedback.</p>
        <p className="text-sm text-muted">{props.remaining === null ? "Unlimited sets." : `${props.remaining} set${props.remaining === 1 ? "" : "s"} left today. ${props.resets}.`}</p>
        <Button block size="lg" disabled={pending || props.remaining === 0} onClick={generate}>
          {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null} Generate my questions
        </Button>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      </div>
    );

  const q = props.questions[index];
  const a = answers[index];
  const done = Object.keys(answers).length;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          Question {index + 1} of {props.questions.length} · {done} answered
        </span>
        <button type="button" onClick={generate} disabled={pending || props.remaining === 0} className="inline-flex items-center gap-1 hover:text-fg">
          <RefreshCw className="size-4" aria-hidden /> New set
        </button>
      </div>
      <section className="rounded-3xl bg-fg p-6 text-bg">
        <p className="eyebrow !text-bg/70">The judge asks</p>
        <p className="mt-2 text-xl font-semibold">{q}</p>
      </section>
      {a ? (
        <section className="space-y-3 rounded-3xl border border-border p-5" aria-live="polite">
          <p className="font-semibold">Practice rating: {a.rating}/5</p>
          <p className="text-muted">{a.feedback}</p>
          <p className="text-sm">
            <span className="font-semibold">A stronger answer: </span>
            {a.strongerAnswer}
          </p>
          <details className="text-sm text-muted">
            <summary className="cursor-pointer">Your answer</summary>
            <p className="mt-2 whitespace-pre-wrap">{a.answer}</p>
          </details>
        </section>
      ) : (
        <>
          <SpeechInput value={draft} onChange={setDraft} label="Your answer" rows={5} placeholder="Answer as you would to the judge…" />
          <Button
            block
            size="lg"
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
          Previous
        </Button>
        <Button variant="outline" className="flex-1" disabled={index + 1 >= props.questions.length} onClick={() => { setIndex(index + 1); setDraft(""); }}>
          Next question
        </Button>
      </div>
      <p className="text-xs text-muted">AI-generated practice questions. Real judges may ask different questions.</p>
    </div>
  );
}
