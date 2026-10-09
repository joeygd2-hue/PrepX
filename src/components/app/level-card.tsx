import { ProgressBar } from "@/components/ui/progress";
import type { levelFor } from "@/lib/levels";

export function LevelCard({ level, total, week }: { level: ReturnType<typeof levelFor>; total: number; week: number }) {
  return (
    <section aria-label="Level and XP" className="flex items-center gap-4 rounded-3xl border border-border p-4 sm:p-5">
      <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-fg text-lg font-semibold text-bg tabular">{level.level}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-semibold">{level.name}</p>
          <p className="text-sm text-muted tabular">+{week} XP this week</p>
        </div>
        <ProgressBar value={level.progress * 100} className="mt-2" label="Progress to next level" />
        <p className="mt-2 text-sm text-muted tabular">
          {total.toLocaleString()} XP{level.next ? ` · ${level.toNext.toLocaleString()} to ${level.next.name}` : " · Top level reached"}
        </p>
      </div>
    </section>
  );
}
