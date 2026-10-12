"use client";
import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { ArrowUpRight, BookOpen, Brain, CalendarDays, Check, FileText, Layers, MessageCircle, Mic, Repeat, Timer, Zap } from "lucide-react";
import { cn } from "@/lib/cn";
import { toggleTask } from "@/app/actions/plan";

type Task = { id: string; kind: string; title: string; minutes: number; description: string; href: string; completedAt: Date | null };
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  quick10: Zap, judge: Mic, coach: MessageCircle, lesson: BookOpen, flashcards: Layers, mistakes: Repeat, rehearsal: Timer, sprint: Zap, entry: FileText, presentation: FileText,
};

/** goalMinutes is today's planner goal; 0 means today is a rest day in the study planner. */
export function TodayPlan({ headline, tasks, goalMinutes }: { headline: string; tasks: Task[]; goalMinutes?: number }) {
  const [optimistic, setOptimistic] = useOptimistic(tasks, (state, id: string) => state.map((t) => (t.id === id ? { ...t, completedAt: t.completedAt ? null : new Date() } : t)));
  const [, start] = useTransition();
  const minutes = tasks.reduce((a, t) => a + t.minutes, 0);
  const done = optimistic.filter((t) => t.completedAt).length;
  const restDay = goalMinutes === 0;
  return (
    <section aria-labelledby="today-plan" className="rounded-[24px] border border-border bg-card p-5 shadow-card sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p id="today-plan" className="eyebrow">
          {restDay ? "Rest day · optional practice" : goalMinutes ? `Today's plan · ${goalMinutes} min goal` : `Today's plan · about ${minutes} min`}
        </p>
        <div className="flex items-center gap-1.5" aria-label={`${done} of ${tasks.length} done`}>
          {optimistic.map((t) => (
            <span key={t.id} className={cn("h-1.5 w-5 rounded-full transition-colors duration-300", t.completedAt ? "bg-accent" : "bg-subtle-2")} aria-hidden />
          ))}
          <span className="ml-1 font-mono text-xs font-medium tabular">
            {done}/{tasks.length}
          </span>
        </div>
      </div>
      <h3 className="mt-3 text-lg font-semibold leading-snug tracking-[-0.02em]">{headline}</h3>
      <ul className="mt-5 space-y-2">
        {optimistic.map((t) => {
          const Icon = ICONS[t.kind] ?? Brain;
          const checked = Boolean(t.completedAt);
          return (
            <li key={t.id} className={cn("flex gap-3 rounded-[16px] border p-3 transition-colors", checked ? "border-transparent bg-subtle/70" : "border-border hover:border-border-strong")}>
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                aria-label={`Mark "${t.title}" ${checked ? "not done" : "done"}`}
                onClick={() => start(async () => { setOptimistic(t.id); await toggleTask(t.id); })}
                className={cn(
                  "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-[8px] border-[1.5px] transition-colors",
                  checked ? "border-accent bg-accent text-accent-fg" : "border-border-strong hover:border-fg",
                )}
              >
                {checked ? <Check className="pop-in size-4" strokeWidth={3} aria-hidden /> : null}
              </button>
              <Link href={t.href} className="group/task min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className={cn("font-semibold tracking-[-0.01em]", checked && "text-muted line-through decoration-1")}>{t.title}</span>
                  <span className="font-mono text-[11px] text-muted">{t.minutes} min</span>
                  <ArrowUpRight className="ml-auto size-4 shrink-0 text-muted opacity-0 transition-opacity group-hover/task:opacity-100" aria-hidden />
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-muted">{t.description}</span>
              </Link>
              <Icon className="mt-0.5 size-[18px] shrink-0 text-muted" aria-hidden />
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-xs text-muted">Tasks complete automatically when you finish the activity.</p>
        <div className="flex items-center gap-3 text-xs font-medium">
          <Link href="/study/focus" className="inline-flex items-center gap-1 text-fg underline-offset-2 hover:underline">
            <Timer className="size-3.5" aria-hidden />
            Focus mode
          </Link>
          <Link href="/study/planner" className="inline-flex items-center gap-1 text-muted underline-offset-2 hover:text-fg hover:underline">
            <CalendarDays className="size-3.5" aria-hidden />
            {restDay ? "Edit study days" : "Planner"}
          </Link>
        </div>
      </div>
    </section>
  );
}
