"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="mx-auto max-w-md px-6 pt-24 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-muted">Your progress is saved. Try again, and if it keeps happening, send us feedback from your Profile.</p>
      {error.digest ? <p className="mt-2 text-xs text-muted">Reference: {error.digest}</p> : null}
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
