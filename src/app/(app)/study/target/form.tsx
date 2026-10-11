"use client";
import { useActionState, useState } from "react";
import { FieldError, Input, Label } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { setTarget } from "@/app/actions/study";

type Option = { id: string; label: string; detail: string; status: string };

export function TargetForm({ org, current, currentDate, competitions }: { org: string; current: string; currentDate: string | null; competitions: Option[] }) {
  const [state, action] = useActionState(setTarget, undefined);
  const [choice, setChoice] = useState(current);
  const options: Option[] = [
    { id: "auto", label: "Next official competition for my region (automatic)", detail: "", status: "" },
    ...competitions,
    { id: "custom", label: "My own date", detail: "", status: "" },
  ];
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="org" value={org} />
      <input type="hidden" name="mode" value={choice === "auto" ? "auto" : choice === "custom" ? "custom" : "competition"} />
      <input type="hidden" name="competitionId" value={choice !== "auto" && choice !== "custom" ? choice : ""} />
      <fieldset className="space-y-2.5">
        <legend className="sr-only">Target</legend>
        {options.map((c) => (
          <label
            key={c.id}
            className="flex cursor-pointer items-start gap-3.5 rounded-[16px] border border-border bg-card p-4 shadow-card transition-colors hover:border-border-strong has-[:checked]:border-fg has-[:checked]:ring-4 has-[:checked]:ring-accent/30"
          >
            <input
              type="radio"
              name="choice"
              value={c.id}
              checked={choice === c.id}
              onChange={() => setChoice(c.id)}
              className="mt-px size-5 shrink-0 cursor-pointer appearance-none rounded-full border-[1.5px] border-border-strong bg-card transition-[border-color,border-width] duration-150 checked:border-[6px] checked:border-primary"
            />
            <span className="min-w-0">
              <span className="font-medium tracking-[-0.01em]">{c.label}</span>
              {c.status && c.status !== "confirmed" ? <span className="ml-2 text-xs font-medium text-warning">({c.status})</span> : null}
              {c.detail ? (
                <>
                  <span className="sr-only"> · </span>
                  <span className="mt-1 block font-mono text-[11px] uppercase tracking-[0.1em] text-muted">{c.detail}</span>
                </>
              ) : null}
            </span>
          </label>
        ))}
      </fieldset>
      {choice === "custom" ? (
        <div>
          <Label htmlFor="date">Date</Label>
          <Input id="date" name="date" type="date" defaultValue={currentDate ?? ""} required />
        </div>
      ) : null}
      <FieldError>{state?.error}</FieldError>
      <SubmitButton block size="lg">
        Save
      </SubmitButton>
    </form>
  );
}
