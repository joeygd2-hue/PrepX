"use client";
import { useTransition } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { selectEvent } from "@/app/actions/study";

/** Rendered on the event page's hero surface. */
export function SelectEventButton({ eventId, isCurrent }: { eventId: string; isCurrent: boolean }) {
  const [pending, start] = useTransition();
  if (isCurrent)
    return (
      <ButtonLink href="/study" variant="hero" block size="lg">
        <Check className="size-5" aria-hidden /> This is your event · Go to Study
      </ButtonLink>
    );
  return (
    <Button variant="accent" block size="lg" disabled={pending} onClick={() => start(() => selectEvent(eventId))}>
      {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null} Study this event
      {pending ? null : <ArrowRight className="size-5 transition-transform group-hover/btn:translate-x-0.5" aria-hidden />}
    </Button>
  );
}
