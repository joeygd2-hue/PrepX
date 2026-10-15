"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/form";
import { stopFamily } from "@/app/actions/family";

export function StopButton({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState<boolean | null>(null);
  if (done !== null)
    return (
      <Notice tone={done ? "success" : "warning"} className="mt-8 font-semibold">
        {done ? "Stopped. You won't get more emails." : "This link is no longer active."}
      </Notice>
    );
  return (
    <Button className="mt-8" size="lg" variant="danger" disabled={pending} onClick={() => start(async () => setDone(await stopFamily(token)))}>
      Stop emails
    </Button>
  );
}
