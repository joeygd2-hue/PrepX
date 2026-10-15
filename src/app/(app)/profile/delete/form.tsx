"use client";
import { useActionState } from "react";
import { FieldError, Input, Label } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { deleteMyAccount } from "@/app/actions/profile";

export function DeleteForm() {
  const [state, action] = useActionState(deleteMyAccount, undefined);
  return (
    <form action={action} className="space-y-3">
      <Label htmlFor="confirm">Type DELETE to confirm</Label>
      <Input id="confirm" name="confirm" autoComplete="off" required />
      <FieldError>{state?.error}</FieldError>
      <SubmitButton variant="danger" block size="lg" pendingText="Deleting…">
        Permanently delete my account
      </SubmitButton>
    </form>
  );
}
