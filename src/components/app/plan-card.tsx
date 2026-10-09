import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import type { Plan } from "@/lib/plan";
import { weeksLabel } from "@/lib/dates";
import type { Target } from "@/server/dashboard";

export function PlanCard({ plan, target }: { plan: Plan; target: Target | null }) {
  if (plan.mode === "past")
    return (
      <section className="rounded-3xl border border-border p-6">
        <p className="eyebrow">{plan.status}</p>
        <h2 className="mt-2 text-xl font-semibold">{plan.status === "Competition day" ? "Good luck today!" : "This competition has passed"}</h2>
        <p className="mt-2 text-muted">Pick your next competition to get a fresh plan.</p>
        <Link href="/study/target" className="mt-3 inline-block font-medium underline underline-offset-2">
          Choose next date
        </Link>
      </section>
    );
  return (
    <section aria-labelledby="plan-title" className="rounded-3xl border border-border p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow">
          {plan.mode === "no-date" ? "Estimated plan · no date set" : `${plan.daysLeft} days to ${target?.name ?? "competition"}`}
        </p>
        <Link href="/study/target" className="shrink-0 text-sm font-medium underline-offset-2 hover:underline">
          {plan.mode === "no-date" ? "Set date" : "Change"}
        </Link>
      </div>
      <h2 id="plan-title" className="mt-2 text-xl font-semibold">
        {plan.status}
      </h2>
      <p className="mt-1 text-sm text-muted">
        Aim for 80 readiness by competition day{plan.daysLeft !== null ? ` · ${weeksLabel(plan.daysLeft)} left` : ""}
        {plan.mode === "condensed" ? " · condensed plan for the time you have" : ""}
      </p>
      <ol className="mt-5 space-y-5">
        {plan.milestones.map((m) => (
          <li key={m.key} className="flex gap-3">
            {m.done ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 fill-fg text-bg" aria-label="Done" /> : <Circle className="mt-0.5 size-5 shrink-0" aria-label="Not done" />}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-semibold">{m.heading}</p>
                <p className="shrink-0 text-sm text-muted tabular">{m.dueInDays > 0 ? `in ${m.dueInDays}d` : m.dueInDays === 0 ? "today" : m.done ? "done" : `${-m.dueInDays}d late`}</p>
              </div>
              <ul className="mt-1 space-y-0.5 text-sm">
                {m.criteria.map((c) => (
                  <li key={c.id} className={c.met ? "text-muted line-through" : ""}>
                    {c.label}
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
