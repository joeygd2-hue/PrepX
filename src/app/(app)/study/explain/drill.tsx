"use client";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SpeechInput } from "@/components/app/speech-input";
import { explainBack } from "@/app/actions/ai";
import { cn } from "@/lib/cn";

const VERDICT = { got_it: "You've got it", close: "Close", not_yet: "Not yet" } as const;

export function ExplainDrill({ cards, remaining }: { cards: { id: string; term: string }[]; remaining: number | null }) {
  const [i, setI] = useState(0);
  const [text, setText] = useState("");
  const [left, setLeft] = useState(remaining);
  const [result, setResult] = useState<{ verdict: keyof typeof VERDICT; feedback: string; definition: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const card = cards[i % cards.length];
  return (
    <div className="space-y-5">
      <p className="text-muted">Explain this term in your own words, as if teaching a friend. Examples count.</p>
      <section className="rounded-3xl bg-fg p-8 text-center text-bg">
        <p className="text-3xl font-semibold">{card.term}</p>
      </section>
      {result ? (
        <section aria-live="polite" className={cn("rounded-3xl p-5", result.verdict === "got_it" ? "bg-success/10" : result.verdict === "close" ? "bg-warning/10" : "bg-danger/10")}>
          <p className="text-lg font-semibold">{VERDICT[result.verdict]}</p>
          <p className="mt-1">{result.feedback}</p>
          <p className="mt-3 text-sm text-muted">
            <span className="font-semibold text-fg">Reference: </span>
            {result.definition}
          </p>
          <Button className="mt-4" onClick={() => { setI(i + 1); setText(""); setResult(null); }}>
            Next term
          </Button>
        </section>
      ) : (
        <>
          <SpeechInput value={text} onChange={setText} label="Your explanation" rows={4} placeholder="It means… for example…" />
          <p className="text-sm text-muted">{left === null ? "Unlimited checks." : `${left} check${left === 1 ? "" : "s"} left today.`}</p>
          <Button
            block
            size="lg"
            disabled={pending || !text.trim() || left === 0}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await explainBack(card.id, text);
                if (!r.ok) setError(r.error);
                else {
                  setResult(r.data!);
                  setLeft((x) => (x === null ? x : x - 1));
                }
              })
            }
          >
            {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null} Check my explanation
          </Button>
          <button type="button" className="block w-full text-center text-sm font-medium" onClick={() => { setI(i + 1); setText(""); }}>
            Skip this term
          </button>
        </>
      )}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
