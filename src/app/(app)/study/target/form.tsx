"use client";
import { useActionState, useState } from "react";
import { FieldError, Input, Label } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { setTarget } from "@/app/actions/study";

export function TargetForm({ org, current, currentDate, competitions }: { org: string; current: string; currentDate: string | null; competitions: { id: string; label: string; status: string }[] }) {
  const [state, action] = useActionState(setTarget, undefined);
  const [choice, setChoice] = useState(current);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="org" value={org} />
      <input type="hidden" name="mode" value={choice === "auto" ? "auto" : choice === "custom" ? "custom" : "competition"} />
      <input type="hidden" name="competitionId" value={choice !== "auto" && choice !== "custom" ? choice : ""} />
      <fieldset className="space-y-2">
        <legend className="sr-only">Target</legend>
        {[{ id: "auto", label: "Next official competition for my region (automatic)", status: "" }, ...competitions, { id: "custom", label: "My own date", status: "" }].map((c) => (
          <label key={c.id} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-4 has-[:checked]:border-fg has-[:checked]:bg-subtle">
            <input type="radio" name="choice" value={c.id} checked={choice === c.id} onChange={() => setChoice(c.id)} className="mt-1 size-4 accent-[var(--fg)]" />
            <span>
              <span className="font-medium">{c.label}</span>
              {c.status && c.status !== "confirmed" ? <span className="ml-2 text-xs text-warning">({c.status})</span> : null}
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
