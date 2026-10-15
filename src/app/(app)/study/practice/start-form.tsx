"use client";
import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/form";
import { startPracticeAction } from "@/app/actions/exam";

/** Start/resume form. Rendered on a hero surface (practice start and lesson check cards). */
export function StartForm({ exam, mode, unit, resume, allowanceNote, disabled }: { exam: string; mode: string; unit?: string; resume: boolean; allowanceNote: string | null; disabled: boolean }) {
  const [state, action] = useActionState(startPracticeAction, undefined);
  return (
    <form action={action} className="mt-7 space-y-3">
      <input type="hidden" name="exam" value={exam} />
      <input type="hidden" name="mode" value={mode} />
      {unit ? <input type="hidden" name="unit" value={unit} /> : null}
      {allowanceNote && !resume ? <p className="text-sm text-hero-muted">{allowanceNote}</p> : null}
      {state?.error ? (
        <Notice tone={state.limit ? "warning" : "error"} className={state.limit ? "border-warning/40 bg-warning/15 text-hero-fg" : "border-danger/40 bg-danger/15 text-hero-fg"}>
          {state.error}{" "}
          {state.limit ? (
            <Link href="/profile/plan" className="font-semibold underline underline-offset-2">
              See plans
            </Link>
          ) : null}
        </Notice>
      ) : null}
      {disabled ? (
        <Notice tone="warning" className="border-warning/40 bg-warning/15 text-hero-fg">
          You&apos;ve used this season&apos;s free full practice exams.{" "}
          <Link href="/profile/plan" className="font-semibold underline underline-offset-2">
            See plans
          </Link>{" "}
          or keep practicing with Quick 10, which is unlimited.
        </Notice>
      ) : (
        <SubmitButton variant="accent" block size="lg" pendingText="Starting…">
          {resume ? "Resume where you left off" : "Start"}
          <ArrowRight className="size-5 transition-transform group-hover/btn:translate-x-0.5" aria-hidden />
        </SubmitButton>
      )}
    </form>
  );
}
