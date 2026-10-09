import { ProgressBar, Ring } from "@/components/ui/progress";
import type { ReadinessPart } from "@/lib/plan";

export function ReadinessCard({ score, label, parts }: { score: number; label: string; parts: ReadinessPart[] }) {
  return (
    <section aria-label="Readiness" className="rounded-3xl border border-border p-5 sm:p-6">
      <div className="flex items-center gap-5">
        <Ring value={score} label="Readiness" />
        <div>
          <p className="eyebrow">Readiness</p>
          <p className="text-xl font-semibold">{label}</p>
        </div>
      </div>
      <div className="mt-5 space-y-4">
        {parts.map((p) => (
          <div key={p.id}>
            <div className="mb-1.5 flex justify-between text-sm">
              <span>
                {p.label} · {Math.round(p.weight * 100)}%
              </span>
              <span className="font-semibold tabular">{Math.round(p.value)}</span>
            </div>
            <ProgressBar value={p.value} label={p.label} />
          </div>
        ))}
      </div>
    </section>
  );
}
