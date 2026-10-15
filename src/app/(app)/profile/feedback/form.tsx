"use client";
import { useActionState } from "react";
import { FieldError, Label, Notice, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { submitFeedback } from "@/app/actions/profile";

export function FeedbackForm({ kinds, placeholder }: { kinds: [string, string][]; placeholder?: string }) {
  const [state, action] = useActionState(submitFeedback, undefined);
  if (state?.ok) return <Notice tone="success">{state.ok}</Notice>;
  return (
    <form action={action} className="space-y-4">
      {kinds.length > 1 ? (
        <div>
          <Label htmlFor="kind">Type</Label>
          <Select id="kind" name="kind">
            {kinds.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </div>
      ) : (
        <input type="hidden" name="kind" value={kinds[0][0]} />
      )}
      <div>
        <Label htmlFor="body">Message</Label>
        <Textarea id="body" name="body" rows={6} required maxLength={5000} placeholder={placeholder} />
      </div>
      <FieldError>{state?.error}</FieldError>
      <SubmitButton block size="lg">
        Send
      </SubmitButton>
    </form>
  );
}
