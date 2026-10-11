"use client";
import { useState, useTransition } from "react";
import { Check, RotateCcw, RotateCw, Star } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, HeroTexture } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { cn } from "@/lib/cn";
import { finishFlashcardSession, reviewCard, toggleDifficult } from "@/app/actions/flashcards";

type Flashcard = { id: string; term: string; definition: string; unit: string; difficult: boolean };

export function Deck({ cards }: { cards: Flashcard[] }) {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [difficult, setDifficult] = useState<Record<string, boolean>>(Object.fromEntries(cards.map((c) => [c.id, c.difficult])));
  const [stats, setStats] = useState({ know: 0, again: 0 });
  const [, start] = useTransition();
  const card = cards[i];

  if (!cards.length)
    return (
      <Card tone="subtle" className="text-center">
        <p className="text-muted">No cards in this view.</p>
      </Card>
    );
  if (!card) {
    return (
      <section className="relative overflow-hidden rounded-[28px] bg-hero p-6 text-center text-hero-fg shadow-float sm:p-10" role="status">
        <HeroTexture />
        <div className="relative">
          <span aria-hidden className="pop-in inline-flex size-12 items-center justify-center rounded-full bg-accent text-accent-fg">
            <Check className="size-6" strokeWidth={3} />
          </span>
          <p className="mt-5 text-2xl font-semibold tracking-[-0.03em]">Session complete</p>
          <p className="mt-2 font-mono text-sm text-hero-muted tabular">
            {stats.know} known · {stats.again} to review again
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button variant="hero" onClick={() => { setI(0); setFlipped(false); setStats({ know: 0, again: 0 }); }}>
              <RotateCcw className="size-4" aria-hidden /> Go again
            </Button>
            <ButtonLink href="/study" variant="accent">
              Back to Study
            </ButtonLink>
          </div>
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
      <div className="mb-4 flex items-center gap-3">
        <ProgressBar value={i} max={cards.length} label="Deck progress" className="flex-1" />
        <p className="shrink-0 font-mono text-xs text-muted tabular">
          Card {i + 1} of {cards.length}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setFlipped(!flipped)}
        aria-label={flipped ? "Show term" : "Show definition"}
        className="group/card block w-full rounded-[28px] text-center perspective-[1600px]"
      >
        {/* Keyed per card so a new card starts face up instead of animating back from the definition. */}
        <span key={card.id} className={cn("grid transition-transform duration-500 ease-[cubic-bezier(.2,.7,.2,1)] transform-3d", flipped && "rotate-y-180")}>
          <span
            aria-hidden
            className="flex min-h-72 flex-col items-center justify-center rounded-[28px] border border-border bg-card p-8 shadow-float transition-colors backface-hidden [grid-area:1/1] group-hover/card:border-border-strong"
          >
            <span className="eyebrow">{card.unit || "Term"}</span>
            <span className="mt-4 text-[1.9rem] font-semibold leading-[1.1] tracking-[-0.035em] text-balance break-words">{card.term}</span>
            <span className="mt-8 inline-flex items-center gap-1.5 text-sm text-muted">
              <RotateCw className="size-3.5 transition-transform duration-300 group-hover/card:rotate-45" /> Tap to flip
            </span>
          </span>
          <span
            aria-hidden
            className="relative flex min-h-72 flex-col items-center justify-center overflow-hidden rounded-[28px] bg-hero p-8 text-hero-fg shadow-float backface-hidden rotate-y-180 [grid-area:1/1]"
          >
            <HeroTexture />
            <span className="eyebrow relative !text-hero-muted">Definition</span>
            <span className="relative mt-4 max-w-md text-lg leading-relaxed break-words">{card.definition}</span>
          </span>
        </span>
        <span className="sr-only" aria-live="polite">
          {flipped ? card.definition : card.term}
        </span>
      </button>
      <div className="mt-5 flex items-center gap-3">
        <Button
          variant="subtle"
          aria-pressed={difficult[card.id]}
          aria-label={difficult[card.id] ? "Unmark difficult" : "Mark difficult"}
          className={cn("w-12 shrink-0 px-0", difficult[card.id] && "bg-primary text-primary-fg hover:bg-primary")}
          onClick={() => {
            const v = !difficult[card.id];
            setDifficult({ ...difficult, [card.id]: v });
            start(() => toggleDifficult(card.id, v));
          }}
        >
          <Star className={cn("size-4", difficult[card.id] && "fill-current")} aria-hidden />
        </Button>
        <Button variant="outline" className="flex-1 px-3" onClick={() => rate("again")}>
          Still learning
        </Button>
        <Button variant="accent" className="flex-1 px-3" onClick={() => rate("know")}>
          Got it
        </Button>
      </div>
    </div>
  );
}
