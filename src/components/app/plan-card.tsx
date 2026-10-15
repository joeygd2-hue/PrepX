import Link from "next/link";
import { Check } from "lucide-react";
import type { Plan } from "@/lib/plan";
import { weeksLabel } from "@/lib/dates";
import { cn } from "@/lib/cn";
import type { Target } from "@/server/dashboard";

const STATUS_TONE: Record<string, string> = {
  "On track": "bg-accent text-accent-fg",
  Ahead: "bg-accent text-accent-fg",
  Behind: "bg-danger/12 text-danger",
};

export function PlanCard({ plan, target }: { plan: Plan; target: Target | null }) {
  if (plan.mode === "past")
    return (
      <section className="rounded-[24px] border border-border bg-card p-6 shadow-card">
        <p className="eyebrow">{plan.status}</p>
        <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em]">{plan.status === "Competition day" ? "Good luck today!" : "This competition has passed"}</h2>
        <p className="mt-2 text-muted">Pick your next competition to get a fresh plan.</p>
        <Link href="/study/target" className="mt-4 inline-block font-medium underline underline-offset-4">
          Choose next date
        </Link>
      </section>
    );
  const nextIndex = plan.milestones.findIndex((m) => !m.done);
  return (
    <section aria-labelledby="plan-title" className="rounded-[24px] border border-border bg-card p-5 shadow-card sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow">{plan.mode === "no-date" ? "Estimated plan · no date set" : `${plan.daysLeft} days to ${target?.name ?? "competition"}`}</p>
        <Link href="/study/target" className="shrink-0 rounded-[10px] px-2 py-1 text-sm font-medium text-muted transition-colors hover:bg-subtle hover:text-fg">
          {plan.mode === "no-date" ? "Set date" : "Change"}
        </Link>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h2 id="plan-title" className="text-2xl font-semibold tracking-[-0.03em]">
          {plan.status}
        </h2>
        <span className={cn("rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium", STATUS_TONE[plan.status] ?? "bg-subtle")}>
          {plan.milestones.filter((m) => m.done).length}/{plan.milestones.length} milestones
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">
        Aim for 80 readiness by competition day{plan.daysLeft !== null ? ` · ${weeksLabel(plan.daysLeft)} left` : ""}
        {plan.mode === "condensed" ? " · condensed plan for the time you have" : ""}
      </p>
      <ol className="relative mt-6">
        {plan.milestones.map((m, i) => {
          const isNext = i === nextIndex;
          const last = i === plan.milestones.length - 1;
          return (
            <li key={m.key} className="relative flex gap-4 pb-6 last:pb-0">
              {!last ? <span aria-hidden className={cn("absolute left-[11px] top-7 h-[calc(100%-1.5rem)] w-px", m.done ? "bg-accent" : "bg-border-strong")} /> : null}
              <span
                aria-label={m.done ? "Done" : isNext ? "Up next" : "Not done"}
                role="img"
                className={cn(
                  "relative z-[1] mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border-[1.5px]",
                  m.done ? "border-accent bg-accent text-accent-fg" : isNext ? "border-fg bg-card" : "border-border-strong bg-card",
                )}
              >
                {m.done ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : isNext ? <span className="size-2 rounded-full bg-fg" aria-hidden /> : null}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className={cn("font-semibold tracking-[-0.01em]", !m.done && !isNext && "text-fg/80")}>{m.heading}</p>
                  <p className="shrink-0 font-mono text-xs text-muted tabular">{m.dueInDays > 0 ? `in ${m.dueInDays}d` : m.dueInDays === 0 ? "today" : m.done ? "done" : `${-m.dueInDays}d late`}</p>
                </div>
                <ul className="mt-1.5 space-y-1 text-sm">
                  {m.criteria.map((c) => (
                    <li key={c.id} className={cn("flex items-center gap-2", c.met ? "text-muted line-through decoration-1" : "text-fg/85")}>
                      <span aria-hidden className={cn("size-1 rounded-full", c.met ? "bg-muted" : "bg-fg/60")} />
                      {c.label}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
