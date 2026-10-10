"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowRight } from "lucide-react";
import { FieldError } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/cn";
import { joinAction } from "@/app/actions/chapter";

export function JoinForm({ initial, sharing }: { initial: string; sharing: boolean }) {
  const [state, action] = useActionState(joinAction, undefined);
  const [code, setCode] = useState(initial.toUpperCase());
  return (
    <form action={action} className="mt-9">
      <label htmlFor="code" className="mb-2 block text-sm font-medium">
        Join code
      </label>
      <div className="relative">
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
          aria-describedby="code-error code-count"
          className="h-20 w-full rounded-[18px] border border-border-strong bg-card text-center font-mono text-[2rem] font-medium tracking-[0.42em] shadow-card transition-[border-color,box-shadow] duration-150 placeholder:text-muted/35 focus:border-fg focus:outline-none focus:ring-4 focus:ring-accent/35"
        />
        <span id="code-count" className="pointer-events-none absolute bottom-2 right-3 font-mono text-[11px] text-muted tabular">
          {code.length}/6
        </span>
      </div>
      <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className={cn("h-1 w-6 rounded-full transition-colors duration-200", i < code.length ? "bg-accent shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--fg)_20%,transparent)]" : "bg-subtle-2")} />
        ))}
      </div>
      <div id="code-error">
        <FieldError>{state?.error}</FieldError>
      </div>
      <label className="mt-7 flex cursor-pointer items-start gap-3 rounded-[16px] border border-border bg-card p-4 shadow-card transition-[border-color,box-shadow] duration-200 hover:border-border-strong has-[:checked]:border-fg has-[:checked]:ring-4 has-[:checked]:ring-accent/30">
        <input type="checkbox" name="shareActivity" defaultChecked={sharing} className="mt-0.5 size-5 shrink-0 accent-[var(--fg)]" />
        <span>
          <span className="block font-medium tracking-[-0.01em]">Share my weekly study activity with chapter leaders</span>
          <span className="mt-0.5 block text-sm text-muted">Advisors and board members see how many practice questions you answered this week. Optional; change it anytime in Profile.</span>
        </span>
      </label>
      <SubmitButton block size="lg" className="mt-6" disabled={code.length !== 6} pendingText="Joining…">
        Join chapter <ArrowRight className="size-5 transition-transform group-hover/btn:translate-x-0.5" aria-hidden />
      </SubmitButton>
      <div className="mt-5 text-center">
        <Link href="/chapter" className="rounded-full px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:text-fg">
          Cancel
        </Link>
      </div>
    </form>
  );
}
