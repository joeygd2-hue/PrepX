"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowRight } from "lucide-react";
import { FieldError } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { joinAction } from "@/app/actions/chapter";

export function JoinForm({ initial }: { initial: string }) {
  const [state, action] = useActionState(joinAction, undefined);
  const [code, setCode] = useState(initial.toUpperCase());
  return (
    <form action={action} className="mt-8">
      <label htmlFor="code" className="mb-2 block text-sm font-medium">
        Join code
      </label>
      <input
        id="code"
        name="code"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        inputMode="text"
        maxLength={6}
        required
        placeholder="ABC234"
        aria-describedby="code-error"
        className="h-16 w-full rounded-2xl bg-subtle text-center text-3xl font-semibold tracking-[0.4em] placeholder:text-muted/70 focus:outline-2 focus:outline-fg"
      />
      <div id="code-error">
        <FieldError>{state?.error}</FieldError>
      </div>
      <SubmitButton block size="lg" className="mt-6" disabled={code.length !== 6} pendingText="Joining…">
        <ArrowRight className="size-5" aria-hidden /> Join chapter
      </SubmitButton>
      <div className="mt-6 text-center">
        <Link href="/chapter" className="font-medium">
          Cancel
        </Link>
      </div>
    </form>
  );
}
