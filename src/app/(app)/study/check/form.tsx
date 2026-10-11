"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, Notice, Textarea } from "@/components/ui/form";
import { runCheck } from "@/app/actions/ai";

export function CheckForm({ type, remaining, resets }: { type: "entry" | "presentation"; remaining: number | null; resets: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<{ text: string; limit?: boolean } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="mt-6 space-y-4">
      <div>
        <Label htmlFor="check-text">Your text</Label>
        <Textarea id="check-text" rows={14} maxLength={30000} value={text} onChange={(e) => setText(e.target.value)} className="resize-y" />
        <div className="mt-2 flex items-start justify-between gap-4">
          <p className="min-w-0 text-sm text-muted">{remaining === null ? "Unlimited checks on your plan." : `${remaining} check${remaining === 1 ? "" : "s"} left this season. ${resets}.`}</p>
          <p className="shrink-0 font-mono text-xs leading-5 text-muted tabular">{text.length.toLocaleString()} / 30,000</p>
        </div>
      </div>
      {text.trim().length > 0 && text.trim().length < 200 ? <p className="text-sm text-muted">Add a bit more text (at least 200 characters) for a useful review.</p> : null}
      <Button
        variant="accent"
        block
        size="lg"
        disabled={pending || text.trim().length < 200 || remaining === 0}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await runCheck(type, text);
            if (!r.ok) setError({ text: r.error, limit: r.limit });
            else router.push(`/study/judge/${r.data!.id}`);
          })
        }
      >
        {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null} {pending ? "Reviewing…" : "Check it"}
        {pending ? null : <ArrowRight className="size-5 transition-transform group-hover/btn:translate-x-0.5" aria-hidden />}
      </Button>
      {error ? (
        <Notice tone="error">
          {error.text}{" "}
          {error.limit ? (
            <Link href="/profile/plan" className="font-semibold underline underline-offset-2">
              See plans
            </Link>
          ) : null}
        </Notice>
      ) : null}
    </div>
  );
}
