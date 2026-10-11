"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/form";
import { confirmFamily } from "@/app/actions/family";

export function ConfirmButton({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  if (done) return <Notice tone="success" className="mt-8 font-semibold">Confirmed. Thank you!</Notice>;
  return (
    <Button className="mt-8" size="lg" variant="accent" disabled={pending} onClick={() => start(async () => { await confirmFamily(token); setDone(true); })}>
      Yes, send me the monthly email
    </Button>
  );
}
