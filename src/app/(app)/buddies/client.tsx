"use client";
import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Notice } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { addBuddy, nudgeBuddy, respondBuddy } from "@/app/actions/social";

export function AddBuddy() {
  const [state, action] = useActionState(addBuddy, undefined);
  return (
    <>
    <form action={action} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Label htmlFor="code">Add a buddy by friend code</Label>
        <Input id="code" name="code" required maxLength={12} autoCapitalize="characters" />
      </div>
      <SubmitButton>Add</SubmitButton>
    </form>
      <FieldError>{state?.error}</FieldError>
      {state?.ok ? <Notice tone="success" className="mt-2">{state.ok}</Notice> : null}
    </>
  );
}

export function BuddyActions({ id, mode }: { id: string; mode: "request" | "buddy" }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  if (mode === "request")
    return (
      <span className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => start(() => respondBuddy(id, true))}>
          Accept
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => start(() => respondBuddy(id, false))}>
          Decline
        </Button>
      </span>
    );
  return (
    <span className="flex items-center gap-2">
      {msg ? <span className="text-xs text-muted" role="status">{msg}</span> : null}
      <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => { const r = await nudgeBuddy(id); setMsg(r?.error ?? r?.ok ?? null); })}>
        Nudge
      </Button>
      <Button size="sm" variant="ghost" aria-label="Remove buddy" disabled={pending} onClick={() => start(() => respondBuddy(id, false))}>
        ✕
      </Button>
    </span>
  );
}
