"use client";
import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { FieldError, Input, Label } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { requestCodeAction, verifyCodeAction } from "../actions";

export function EmailForm() {
  const [state, action] = useActionState(requestCodeAction, undefined);
  return (
    <form action={action} className="mt-8">
      <Label htmlFor="email">Email</Label>
      <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required placeholder="you@example.com" aria-describedby="email-error" />
      <FieldError>{state?.error}</FieldError>
      <SubmitButton block size="lg" className="mt-6" pendingText="Sending code…">
        <ArrowRight className="size-4" aria-hidden /> Send code
      </SubmitButton>
    </form>
  );
}

export function CodeForm() {
  const [state, action] = useActionState(verifyCodeAction, undefined);
  return (
    <form action={action} className="mt-8">
      <Label htmlFor="code">6-digit code</Label>
      <Input
        id="code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]{6,7}"
        maxLength={7}
        required
        placeholder="123456"
        className="text-center text-2xl tracking-[0.5em]"
      />
      <FieldError>{state?.error}</FieldError>
      <SubmitButton block size="lg" className="mt-6" pendingText="Checking…">
        <ArrowRight className="size-4" aria-hidden /> Continue
      </SubmitButton>
    </form>
  );
}
