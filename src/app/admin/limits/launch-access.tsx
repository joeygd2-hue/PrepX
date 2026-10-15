"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { setLaunchAccess } from "@/app/actions/admin";
import { Chip } from "@/components/ui/badge";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError, Input, Label, Notice } from "@/components/ui/form";

/** Free Pro for everyone through a chosen day. Both buttons submit the same form; `intent` tells the action which one. */
export function LaunchAccessCard({ active, endsOn }: { active: boolean; endsOn: string | null }) {
  const [state, formAction] = useActionState(setLaunchAccess, undefined);
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-[-0.02em]">Launch access</h2>
          <p className="mt-1 text-sm text-muted">Free Pro for everyone through the last day you choose. That day ends at midnight Hawaii time, so every US time zone gets all of it.</p>
        </div>
        <Chip tone={active ? "accent" : "outline"} className="shrink-0">
          {active ? "Active" : "Off"}
        </Chip>
      </div>
      <p className="mt-4 text-[15px]">
        {active ? (
          <>
            Everyone has Pro through <span className="font-mono font-medium tabular">{endsOn}</span>.
          </>
        ) : endsOn ? (
          <>
            Ended after <span className="font-mono font-medium tabular">{endsOn}</span>.
          </>
        ) : (
          "Students are on their own plans."
        )}
      </p>
      <form action={formAction} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 sm:w-60">
          <Label htmlFor="endsOn">Last free day</Label>
          <Input id="endsOn" name="endsOn" type="date" defaultValue={endsOn ?? ""} required className="font-mono tabular" />
        </div>
        <div className="flex flex-wrap gap-2">
          <IntentButton intent="save">Save</IntentButton>
          <IntentButton intent="end" variant="outline" formNoValidate disabled={!endsOn}>
            End launch access
          </IntentButton>
        </div>
      </form>
      <FieldError>{state?.error}</FieldError>
      {state?.ok ? (
        <Notice tone="success" className="mt-3">
          {state.ok}
        </Notice>
      ) : null}
    </Card>
  );
}

function IntentButton({ intent, children, disabled, ...props }: ButtonProps & { intent: "save" | "end" }) {
  const { pending, data } = useFormStatus();
  const mine = pending && data?.get("intent") === intent;
  return (
    <Button {...props} type="submit" name="intent" value={intent} disabled={pending || disabled} aria-busy={mine}>
      {mine ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </Button>
  );
}
