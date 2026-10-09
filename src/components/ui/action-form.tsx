"use client";
import { useActionState } from "react";
import { FieldError, Notice } from "./form";
import { SubmitButton } from "./submit-button";

type State = { error?: string; ok?: string } | undefined;

export function ActionForm({ action, children, submit = "Save", className }: { action: (s: State, f: FormData) => Promise<State>; children: React.ReactNode; submit?: string; className?: string }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className ?? "space-y-4"}>
      {children}
      <FieldError>{state?.error}</FieldError>
      {state?.ok ? <Notice tone="success">{state.ok}</Notice> : null}
      <SubmitButton>{submit}</SubmitButton>
    </form>
  );
}

export function ActionButton({ onClick, children, variant = "outline" }: { onClick: () => Promise<unknown>; children: React.ReactNode; variant?: "outline" | "danger" | "primary" }) {
  return (
    <form action={async () => { await onClick(); }}>
      <SubmitButton size="sm" variant={variant}>
        {children}
      </SubmitButton>
    </form>
  );
}
