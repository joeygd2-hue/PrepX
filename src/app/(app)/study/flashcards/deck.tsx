"use client";
import { useState, useTransition } from "react";
import { RotateCcw, Star } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress";
import { cn } from "@/lib/cn";
import { finishFlashcardSession, reviewCard, toggleDifficult } from "@/app/actions/flashcards";

type Card = { id: string; term: string; definition: string; unit: string; difficult: boolean };

export function Deck({ cards }: { cards: Card[] }) {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [difficult, setDifficult] = useState<Record<string, boolean>>(Object.fromEntries(cards.map((c) => [c.id, c.difficult])));
  const [stats, setStats] = useState({ know: 0, again: 0 });
  const [, start] = useTransition();
  const card = cards[i];

  if (!cards.length) return <p className="text-muted">No cards in this view.</p>;
  if (!card) {
    return (
      <section className="rounded-3xl border border-border p-6 text-center" role="status">
        <p className="text-2xl font-semibold">Session complete</p>
        <p className="mt-2 text-muted">
          {stats.know} known · {stats.again} to review again
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="outline" onClick={() => { setI(0); setFlipped(false); setStats({ know: 0, again: 0 }); }}>
            <RotateCcw className="size-4" aria-hidden /> Go again
          </Button>
          <ButtonLink href="/study">Back to Study</ButtonLink>
        </div>
      </section>
    );
  }
  const rate = (r: "know" | "again") => {
    const nextStats = { ...stats, [r]: stats[r] + 1 };
    setStats(nextStats);
    start(async () => {
      await reviewCard(card.id, r);
      if (i + 1 >= cards.length) await finishFlashcardSession(nextStats.know + nextStats.again);
    });
    setFlipped(false);
    setI(i + 1);
  };
  return (
    <div>
      <ProgressBar value={i} max={cards.length} label="Deck progress" className="mb-4" />
      <button
        type="button"
        onClick={() => setFlipped(!flipped)}
        aria-label={flipped ? "Show term" : "Show definition"}
        className={cn("flex min-h-64 w-full flex-col items-center justify-center rounded-3xl border-2 p-8 text-center transition-colors", flipped ? "border-fg bg-subtle" : "border-border")}
      >
        <span className="eyebrow">{flipped ? "Definition" : card.unit || "Term"}</span>
        <span className={cn("mt-3", flipped ? "text-lg" : "text-3xl font-semibold")} aria-live="polite">
          {flipped ? card.definition : card.term}
        </span>
        {!flipped ? <span className="mt-6 text-sm text-muted">Tap to flip</span> : null}
      </button>
      <div className="mt-4 flex items-center gap-3">
        <Button
          variant="subtle"
          aria-pressed={difficult[card.id]}
          aria-label={difficult[card.id] ? "Unmark difficult" : "Mark difficult"}
          onClick={() => {
            const v = !difficult[card.id];
            setDifficult({ ...difficult, [card.id]: v });
            start(() => toggleDifficult(card.id, v));
          }}
        >
          <Star className={cn("size-4", difficult[card.id] && "fill-current")} aria-hidden />
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => rate("again")}>
          Still learning
        </Button>
        <Button className="flex-1" onClick={() => rate("know")}>
          Got it
        </Button>
      </div>
      <p className="mt-3 text-center text-sm text-muted tabular">
        Card {i + 1} of {cards.length}
      </p>
    </div>
  );
}
