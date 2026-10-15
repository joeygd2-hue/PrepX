"use client";
import { useState, useTransition } from "react";
import { ArrowRight, CheckCircle2, CircleDashed, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, HeroTexture } from "@/components/ui/card";
import { SpeechInput } from "@/components/app/speech-input";
import { explainBack } from "@/app/actions/ai";
import { cn } from "@/lib/cn";

const VERDICT = { got_it: "You've got it", close: "Close", not_yet: "Not yet" } as const;
const VERDICT_ICON = { got_it: CheckCircle2, close: CircleDashed, not_yet: XCircle } as const;

export function ExplainDrill({ cards, remaining }: { cards: { id: string; term: string }[]; remaining: number | null }) {
  const [i, setI] = useState(0);
  const [text, setText] = useState("");
  const [left, setLeft] = useState(remaining);
  const [result, setResult] = useState<{ verdict: keyof typeof VERDICT; feedback: string; definition: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const card = cards[i % cards.length];
  const Icon = result ? VERDICT_ICON[result.verdict] : null;
  return (
    <div className="space-y-5">
      <p className="text-muted">Explain this term in your own words, as if teaching a friend. Examples count.</p>
      <Card tone="inverse" className="px-6 py-10 text-center shadow-float sm:py-14">
        <HeroTexture />
        <div className="relative">
          <p className="eyebrow !text-hero-muted tabular">
            Term {(i % cards.length) + 1} of {cards.length}
          </p>
          <p className="mt-4 text-[2rem] font-semibold leading-[1.1] tracking-[-0.035em] text-balance break-words sm:text-[2.4rem]">{card.term}</p>
        </div>
      </Card>
      {result && Icon ? (
        <section
          aria-live="polite"
          className={cn(
            "rounded-[24px] border p-5 sm:p-6",
            result.verdict === "got_it" ? "border-success/25 bg-success/10" : result.verdict === "close" ? "border-warning/25 bg-warning/10" : "border-danger/25 bg-danger/10",
          )}
        >
          <p
            className={cn(
              "flex items-center gap-2 text-lg font-semibold tracking-[-0.02em]",
              result.verdict === "got_it" ? "text-success" : result.verdict === "close" ? "text-warning" : "text-danger",
            )}
          >
            <Icon className="pop-in size-5 shrink-0" aria-hidden />
            {VERDICT[result.verdict]}
          </p>
          <p className="mt-2 text-[15px] leading-relaxed">{result.feedback}</p>
          <p className="mt-4 border-t border-border pt-4 text-sm leading-relaxed text-muted">
            <span className="font-semibold text-fg">Reference: </span>
            {result.definition}
          </p>
          <Button className="mt-5" onClick={() => { setI(i + 1); setText(""); setResult(null); }}>
            Next term <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-0.5" aria-hidden />
          </Button>
        </section>
      ) : (
        <>
          <SpeechInput value={text} onChange={setText} label="Your explanation" rows={4} placeholder="It means… for example…" />
          <p className="font-mono text-xs text-muted tabular">{left === null ? "Unlimited checks." : `${left} check${left === 1 ? "" : "s"} left today.`}</p>
          <Button
            variant="accent"
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
          <Button variant="ghost" block onClick={() => { setI(i + 1); setText(""); }}>
            Skip this term
          </Button>
        </>
      )}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
