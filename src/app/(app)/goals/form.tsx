"use client";
import { useActionState } from "react";
import { FieldError, Input, Label, Notice } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Card } from "@/components/ui/card";
import { saveGoals } from "@/app/actions/social";

export function GoalsForm({ eventId, initial, judged }: { eventId: string; initial: { targetReadiness: number; weeklyQuestions: number; weeklyJudgeRuns: number }; judged: boolean }) {
  const [state, action] = useActionState(saveGoals, undefined);
  return (
    <Card>
      <form action={action} className="space-y-4">
        <input type="hidden" name="eventId" value={eventId} />
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="tr">Target readiness</Label>
            <Input id="tr" name="targetReadiness" type="number" min={50} max={100} defaultValue={initial.targetReadiness} />
          </div>
          <div>
            <Label htmlFor="wq">Questions / week</Label>
            <Input id="wq" name="weeklyQuestions" type="number" min={0} max={2000} defaultValue={initial.weeklyQuestions} />
          </div>
          <div>
            <Label htmlFor="wj">Judge runs / week</Label>
            <Input id="wj" name="weeklyJudgeRuns" type="number" min={0} max={50} defaultValue={initial.weeklyJudgeRuns} disabled={!judged} />
          </div>
        </div>
        {!judged ? <input type="hidden" name="weeklyJudgeRuns" value={0} /> : null}
        <FieldError>{state?.error}</FieldError>
        {state?.ok ? <Notice tone="success">{state.ok}</Notice> : null}
        <SubmitButton>Save goals</SubmitButton>
      </form>
    </Card>
  );
}
