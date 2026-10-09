"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { runCheck } from "@/app/actions/ai";

export function CheckForm({ type, remaining, resets }: { type: "entry" | "presentation"; remaining: number | null; resets: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<{ text: string; limit?: boolean } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="mt-5 space-y-3">
      <label htmlFor="check-text" className="block text-sm font-medium">
        Your text
      </label>
      <Textarea id="check-text" rows={14} maxLength={30000} value={text} onChange={(e) => setText(e.target.value)} />
      <p className="text-right text-xs text-muted tabular">{text.length.toLocaleString()} / 30,000</p>
      <p className="text-sm text-muted">{remaining === null ? "Unlimited checks on your plan." : `${remaining} check${remaining === 1 ? "" : "s"} left this season. ${resets}.`}</p>
      <Button
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
      </Button>
      {text.trim().length > 0 && text.trim().length < 200 ? <p className="text-sm text-muted">Add a bit more text (at least 200 characters) for a useful review.</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error.text}{" "}
          {error.limit ? (
            <Link href="/profile/plan" className="font-semibold underline">
              See plans
            </Link>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
