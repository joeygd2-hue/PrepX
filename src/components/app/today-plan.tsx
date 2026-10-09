"use client";
import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { BookOpen, Brain, Check, FileText, Layers, MessageCircle, Mic, Repeat, Timer, Zap } from "lucide-react";
import { cn } from "@/lib/cn";
import { toggleTask } from "@/app/actions/plan";

type Task = { id: string; kind: string; title: string; minutes: number; description: string; href: string; completedAt: Date | null };
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  quick10: Zap, judge: Mic, coach: MessageCircle, lesson: BookOpen, flashcards: Layers, mistakes: Repeat, rehearsal: Timer, sprint: Zap, entry: FileText, presentation: FileText,
};

export function TodayPlan({ headline, tasks }: { headline: string; tasks: Task[] }) {
  const [optimistic, setOptimistic] = useOptimistic(tasks, (state, id: string) => state.map((t) => (t.id === id ? { ...t, completedAt: t.completedAt ? null : new Date() } : t)));
  const [, start] = useTransition();
  const minutes = tasks.reduce((a, t) => a + t.minutes, 0);
  const done = optimistic.filter((t) => t.completedAt).length;
  return (
    <section aria-labelledby="today-plan" className="rounded-3xl border border-border p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <p id="today-plan" className="eyebrow">
          Today&apos;s plan · about {minutes} min
        </p>
        <p className="text-sm font-semibold tabular" aria-label={`${done} of ${tasks.length} done`}>
          {done}/{tasks.length}
        </p>
      </div>
      <h3 className="mt-3 text-lg font-semibold">{headline}</h3>
      <ul className="mt-4 space-y-4">
        {optimistic.map((t) => {
          const Icon = ICONS[t.kind] ?? Brain;
          const checked = Boolean(t.completedAt);
          return (
            <li key={t.id} className="flex gap-3">
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                aria-label={`Mark "${t.title}" ${checked ? "not done" : "done"}`}
                onClick={() => start(async () => { setOptimistic(t.id); await toggleTask(t.id); })}
                className={cn("mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md border-2 border-fg", checked && "bg-fg text-bg")}
              >
                {checked ? <Check className="size-4" aria-hidden /> : null}
              </button>
              <Link href={t.href} className="group min-w-0 flex-1">
                <span className={cn("font-semibold group-hover:underline", checked && "text-muted line-through")}>{t.title}</span>
                <span className="text-sm text-muted"> · {t.minutes} min</span>
                <span className="mt-1 block text-sm text-muted">{t.description}</span>
              </Link>
              <Icon className="mt-1 size-5 shrink-0 text-muted" aria-hidden />
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-xs text-muted">Tasks complete automatically when you finish the activity.</p>
    </section>
  );
}
