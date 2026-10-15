"use client";
import { useActionState, useState } from "react";
import { ArrowRight, Check, Copy, KeyRound, Share2, Swords, UserRound } from "lucide-react";
import { createDuelAction, declineDuelAction, joinDuelAction, startDuelAction } from "@/app/actions/duels";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/form";
import { cn } from "@/lib/cn";

const OPTION =
  "flex min-h-14 cursor-pointer items-center gap-3 rounded-[16px] border border-border bg-card p-4 transition-colors hover:border-border-strong has-[:checked]:border-fg has-[:checked]:ring-4 has-[:checked]:ring-accent/30 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-fg";

/** Pick a study buddy to challenge, or make an invite code to share with anyone. */
export function ChallengeForm({ exam, buddies }: { exam: string; buddies: { userId: string; name: string }[] }) {
  const [state, action] = useActionState(createDuelAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="exam" value={exam} />
      <fieldset className="stagger space-y-2.5">
        <legend className="sr-only">Who do you want to duel?</legend>
        <label className={OPTION}>
          <input type="radio" name="opponent" value="" defaultChecked className="sr-only" />
          <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-subtle text-fg">
            <KeyRound className="size-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium tracking-[-0.01em]">Invite with a code</span>
            <span className="block text-sm text-muted">Share a 6-character code with any friend</span>
          </span>
        </label>
        {buddies.map((b) => (
          <label key={b.userId} className={OPTION}>
            <input type="radio" name="opponent" value={b.userId} className="sr-only" />
            <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-subtle text-fg">
              <UserRound className="size-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium tracking-[-0.01em]">{b.name}</span>
              <span className="block text-sm text-muted">Study buddy · they&apos;ll get a notification</span>
            </span>
          </label>
        ))}
      </fieldset>
      <FieldError>{state?.error}</FieldError>
      <SubmitButton variant="accent" block pendingText="Creating…">
        <Swords className="size-4" aria-hidden /> Create duel
      </SubmitButton>
    </form>
  );
}

export function JoinForm({ initialCode = "", className }: { initialCode?: string; className?: string }) {
  const [state, action] = useActionState(joinDuelAction, undefined);
  return (
    <form action={action} className={cn("space-y-2", className)}>
      <Label htmlFor="duel-code">Duel code</Label>
      <div className="flex gap-2">
        <Input
          id="duel-code"
          name="code"
          defaultValue={initialCode}
          placeholder="ABC234"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={12}
          required
          aria-invalid={state?.error ? true : undefined}
          className="min-w-0 flex-1 font-mono uppercase tracking-[0.2em]"
        />
        <SubmitButton variant="primary" pendingText="Joining…">
          Join
        </SubmitButton>
      </div>
      <FieldError>{state?.error}</FieldError>
    </form>
  );
}

/** Start (or continue) your side of the duel. Rendered on the hero surface. */
export function StartDuelForm({ id, label }: { id: string; label: string }) {
  const [state, action] = useActionState(startDuelAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {state?.error ? (
        <p role="alert" className="rounded-[14px] border border-danger/40 bg-danger/15 px-4 py-3 text-sm text-hero-fg">
          {state.error}
        </p>
      ) : null}
      <SubmitButton variant="accent" block size="lg" pendingText="Starting…">
        {label} <ArrowRight className="size-5 transition-transform group-hover/btn:translate-x-0.5" aria-hidden />
      </SubmitButton>
    </form>
  );
}

export function DeclineDuelForm({ id }: { id: string }) {
  const [state, action] = useActionState(declineDuelAction, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="hero" size="sm" className="h-11 bg-transparent text-hero-fg ring-1 ring-hero-line hover:bg-hero-line/40" pendingText="Declining…">
        Decline
      </SubmitButton>
      {state?.error ? (
        <p role="alert" className="text-sm text-hero-muted">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

/** Copies text; false when the browser has no clipboard access (http, permissions). */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function ShareCode({ code, link, questions }: { code: string; link: string; questions: number }) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [failed, setFailed] = useState(false);
  const done = (what: "code" | "link", ok: boolean) => {
    setCopied(ok ? what : null);
    setFailed(!ok);
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2.5">
        <Button type="button" variant="outline" size="sm" className="h-11" onClick={async () => done("code", await copyText(code))}>
          {copied === "code" ? <Check className="pop-in size-4" strokeWidth={3} aria-hidden /> : <Copy className="size-4" aria-hidden />} {copied === "code" ? "Copied" : "Copy code"}
        </Button>
        <Button
          type="button"
          variant="subtle"
          size="sm"
          className="h-11"
          onClick={async () => {
            const text = `Duel me on PrepX: same ${questions} questions, most right wins. Code ${code}`;
            if (typeof navigator.share === "function") await navigator.share({ title: "PrepX duel", text, url: link }).catch(() => undefined);
            else done("link", await copyText(link));
          }}
        >
          {copied === "link" ? <Check className="pop-in size-4" strokeWidth={3} aria-hidden /> : <Share2 className="size-4" aria-hidden />} {copied === "link" ? "Link copied" : "Share link"}
        </Button>
      </div>
      <p aria-live="polite" className={failed ? "text-sm text-muted" : "sr-only"}>
        {failed ? `Couldn't copy here. Share the code ${code} instead.` : copied === "code" ? "Code copied" : copied === "link" ? "Link copied" : ""}
      </p>
    </div>
  );
}
