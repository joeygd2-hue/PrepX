"use client";
import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/form";
import { startPracticeAction } from "@/app/actions/exam";

export function StartForm({ exam, mode, unit, resume, allowanceNote, disabled }: { exam: string; mode: string; unit?: string; resume: boolean; allowanceNote: string | null; disabled: boolean }) {
  const [state, action] = useActionState(startPracticeAction, undefined);
  return (
    <form action={action} className="mt-6 space-y-3">
      <input type="hidden" name="exam" value={exam} />
      <input type="hidden" name="mode" value={mode} />
      {unit ? <input type="hidden" name="unit" value={unit} /> : null}
      {allowanceNote && !resume ? <p className="text-sm text-muted">{allowanceNote}</p> : null}
      {state?.error ? (
        <Notice tone={state.limit ? "warning" : "error"}>
          {state.error}{" "}
          {state.limit ? (
            <Link href="/profile/plan" className="font-semibold underline">
              See plans
            </Link>
          ) : null}
        </Notice>
      ) : null}
      {disabled ? (
        <Notice tone="warning">
          You&apos;ve used this season&apos;s free full practice exams.{" "}
          <Link href="/profile/plan" className="font-semibold underline">
            See plans
          </Link>{" "}
          or keep practicing with Quick 10, which is unlimited.
        </Notice>
      ) : (
        <SubmitButton block size="lg" pendingText="Starting…">
          <ArrowRight className="size-5" aria-hidden /> {resume ? "Resume where you left off" : "Start"}
        </SubmitButton>
      )}
    </form>
  );
}
