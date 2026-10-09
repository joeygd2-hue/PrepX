import type { FeedbackCriterion } from "@/db/schema";
import { cn } from "@/lib/cn";

export function FeedbackView({ score, criteria, summary, nextSteps, rubricBasis, mock }: { score: number; criteria: FeedbackCriterion[]; summary: string; nextSteps: string[]; rubricBasis: string; mock?: boolean }) {
  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-fg p-6 text-bg">
        <p className="eyebrow !text-bg/70">Simulated practice score</p>
        <p className="mt-2 text-6xl font-semibold tabular">
          {score}
          <span className="text-2xl opacity-60">/100</span>
        </p>
        <p className="mt-3 text-sm opacity-80">
          Practice feedback from AI, not an official result or a prediction of a judge&apos;s score.
          {rubricBasis === "general" ? " Based on general practice criteria, not the official rubric or its point values." : ""}
          {mock ? " Development test provider: not real feedback." : ""}
        </p>
      </section>
      <section className="rounded-3xl border border-border p-5">
        <h2 className="font-semibold">Summary</h2>
        <p className="mt-2 whitespace-pre-wrap text-muted">{summary}</p>
      </section>
      <section className="rounded-3xl border border-border p-5">
        <h2 className="font-semibold">Score breakdown</h2>
        <ul className="mt-3 space-y-4">
          {criteria.map((c) => (
            <li key={c.id}>
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{c.label}</span>
                <span className="flex gap-1" role="img" aria-label={`${c.rating} out of 5`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span key={n} className={cn("h-2 w-5 rounded-full", n <= c.rating ? "bg-fg" : "bg-subtle-2")} />
                  ))}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted">{c.comment}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-3xl bg-subtle p-5">
        <h2 className="font-semibold">Next steps</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          {nextSteps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
