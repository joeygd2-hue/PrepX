import type { FeedbackCriterion } from "@/db/schema";
import { cn } from "@/lib/cn";
import { HeroTexture } from "@/components/ui/card";

export function FeedbackView({ score, criteria, summary, nextSteps, rubricBasis, mock }: { score: number; criteria: FeedbackCriterion[]; summary: string; nextSteps: string[]; rubricBasis: string; mock?: boolean }) {
  return (
    <div className="stagger space-y-3">
      <section className="relative overflow-hidden rounded-[28px] bg-hero p-6 text-hero-fg shadow-float sm:p-8">
        <HeroTexture />
        <div className="relative">
          <p className="eyebrow !text-hero-muted">Simulated practice score</p>
          <p className="mt-6 flex items-end gap-2">
            <span className="font-mono text-[5rem] font-medium leading-[0.8] tracking-[-0.06em] tabular sm:text-[6.5rem]">{score}</span>
            <span className="pb-1 font-mono text-xl text-hero-muted">/100</span>
          </p>
          <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-hero-line" aria-hidden>
            <div className="h-full rounded-full bg-accent transition-[width] duration-1000 ease-out" style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
          </div>
          <p className="mt-5 max-w-lg text-sm leading-relaxed text-hero-muted">
            Practice feedback from AI, not an official result or a prediction of a judge&apos;s score.
            {rubricBasis === "general" ? " Based on general practice criteria, not the official rubric or its point values." : ""}
            {mock ? " Development test provider: not real feedback." : ""}
          </p>
        </div>
      </section>
      <section className="rounded-[24px] border border-border bg-card p-5 shadow-card sm:p-6">
        <h2 className="eyebrow">Summary</h2>
        <p className="mt-3 whitespace-pre-wrap leading-relaxed">{summary}</p>
      </section>
      <section className="rounded-[24px] border border-border bg-card p-5 shadow-card sm:p-6">
        <h2 className="eyebrow">Score breakdown</h2>
        <ul className="mt-4 divide-y divide-border">
          {criteria.map((c) => (
            <li key={c.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium tracking-[-0.01em]">{c.label}</span>
                <span className="flex items-center gap-1" role="img" aria-label={`${c.rating} out of 5`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span key={n} className={cn("h-1.5 w-4 rounded-full sm:w-5", n <= c.rating ? "bg-accent shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--fg)_18%,transparent)]" : "bg-subtle-2")} />
                  ))}
                  <span className="ml-1.5 font-mono text-xs text-muted tabular" aria-hidden>
                    {c.rating}/5
                  </span>
                </span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{c.comment}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-[24px] bg-subtle p-5 sm:p-6">
        <h2 className="eyebrow">Next steps</h2>
        <ol className="mt-4 space-y-3">
          {nextSteps.map((s, i) => (
            <li key={s} className="flex gap-3">
              <span aria-hidden className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-[11px] text-primary-fg tabular">
                {i + 1}
              </span>
              <span className="leading-relaxed">{s}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
