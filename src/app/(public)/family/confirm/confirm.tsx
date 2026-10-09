"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { confirmFamily } from "@/app/actions/family";

export function ConfirmButton({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  if (done) return <p className="mt-6 font-semibold" role="status">Confirmed. Thank you!</p>;
  return (
    <Button className="mt-6" size="lg" disabled={pending} onClick={() => start(async () => { await confirmFamily(token); setDone(true); })}>
      Yes, send me the monthly email
    </Button>
  );
}
