import { ProgressBar, Ring } from "@/components/ui/progress";
import type { ReadinessPart } from "@/lib/plan";

export function ReadinessCard({ score, label, parts }: { score: number; label: string; parts: ReadinessPart[] }) {
  return (
    <section aria-label="Readiness" className="rounded-[24px] border border-border bg-card p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-5">
        <Ring value={score} label="Readiness" />
        <div>
          <p className="eyebrow">Readiness</p>
          <p className="mt-1 text-2xl font-semibold tracking-[-0.03em]">{label}</p>
          <p className="mt-0.5 text-sm text-muted">Target 80 by competition day</p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {parts.map((p) => (
          <div key={p.id} className="rounded-[16px] bg-subtle/70 p-3.5">
            <div className="mb-2 flex items-baseline justify-between text-sm">
              <span>
                {p.label} · {Math.round(p.weight * 100)}%
              </span>
              <span className="font-mono font-medium tabular">{Math.round(p.value)}</span>
            </div>
            <ProgressBar value={p.value} label={p.label} />
          </div>
        ))}
      </div>
    </section>
  );
}
