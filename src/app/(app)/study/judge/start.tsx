"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startJudgeRun } from "@/app/actions/ai";

export function StartJudge({ mode, remaining, resets, disabled }: { mode: "standard" | "face"; remaining: number | null; resets: string; disabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<{ text: string; limit?: boolean } | null>(null);
  const none = remaining !== null && remaining <= 0;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{remaining === null ? "Unlimited judge runs on your plan." : `${remaining} judge run${remaining === 1 ? "" : "s"} left today. ${resets}.`}</p>
      <Button
        block
        size="lg"
        disabled={pending || disabled || none}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await startJudgeRun(mode);
            if (!r.ok) setError({ text: r.error, limit: r.limit });
            else router.push(`/study/judge/${r.data!.id}`);
          })
        }
      >
        {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <ArrowRight className="size-5" aria-hidden />}
        {pending ? "Writing your scenario…" : "Start a practice round"}
      </Button>
      {none ? (
        <p className="text-sm">
          You&apos;ve used today&apos;s judge runs.{" "}
          <Link href="/profile/plan" className="font-semibold underline">
            See plans
          </Link>
        </p>
      ) : null}
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
