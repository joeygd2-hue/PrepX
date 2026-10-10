import { ProgressBar } from "@/components/ui/progress";
import type { levelFor } from "@/lib/levels";

export function LevelCard({ level, total, week }: { level: ReturnType<typeof levelFor>; total: number; week: number }) {
  return (
    <section aria-label="Level and XP" className="flex items-center gap-4 rounded-[24px] border border-border bg-card p-4 shadow-card sm:p-5">
      <span className="relative inline-flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-accent font-mono text-lg font-semibold text-accent-fg tabular">
        {level.level}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-semibold tracking-[-0.01em]">{level.name}</p>
          <p className="font-mono text-xs text-muted tabular">+{week} XP this week</p>
        </div>
        <ProgressBar value={level.progress * 100} className="mt-2.5" label="Progress to next level" />
        <p className="mt-2 font-mono text-xs text-muted tabular">
          {total.toLocaleString()} XP{level.next ? ` · ${level.toNext.toLocaleString()} to ${level.next.name}` : " · Top level reached"}
        </p>
      </div>
    </section>
  );
}
