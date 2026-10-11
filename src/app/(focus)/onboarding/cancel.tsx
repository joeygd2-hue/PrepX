"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cancelSignUp } from "@/app/actions/profile";

/** Lets someone back out mid-sign-up and have everything they entered deleted. */
export function CancelSignUp() {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  if (!confirming)
    return (
      <button type="button" onClick={() => setConfirming(true)} className="mx-auto mt-6 block rounded-full px-3 py-1.5 text-sm text-muted transition-colors hover:text-fg">
        Cancel sign-up
      </button>
    );
  return (
    <div role="group" aria-labelledby="cancel-signup" className="pop-in mt-6 rounded-[16px] border border-border bg-card p-4 shadow-card">
      <p id="cancel-signup" className="text-sm">
        Cancel sign-up? This deletes your account and everything you&apos;ve entered so far.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="danger" disabled={pending} aria-busy={pending} onClick={() => start(() => cancelSignUp())}>
          {pending ? "Deleting…" : "Delete and leave"}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
          Keep going
        </Button>
      </div>
    </div>
  );
}
