"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { stopFamily } from "@/app/actions/family";

export function StopButton({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState<boolean | null>(null);
  if (done !== null) return <p className="mt-6 font-semibold" role="status">{done ? "Stopped. You won't get more emails." : "This link is no longer active."}</p>;
  return (
    <Button className="mt-6" size="lg" variant="danger" disabled={pending} onClick={() => start(async () => setDone(await stopFamily(token)))}>
      Stop emails
    </Button>
  );
}
