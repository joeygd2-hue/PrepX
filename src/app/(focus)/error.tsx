"use client";
import { useEffect } from "react";
import { LogoMark } from "@/components/shell/logo";
import { Button } from "@/components/ui/button";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 py-16 text-center">
      <span className="relative isolate inline-flex">
        <span aria-hidden className="dot-grid absolute -inset-12 -z-10 text-fg opacity-[0.14] [mask-image:radial-gradient(closest-side,#000,transparent)]!" />
        <LogoMark className="size-14 rounded-[18px] shadow-float" />
      </span>
      <h1 className="mt-10 text-balance text-[2rem] font-semibold leading-[1.05] tracking-[-0.035em]">Something went wrong</h1>
      <p className="mt-3 text-pretty text-muted">Your progress is saved. Try again, and if it keeps happening, send us feedback from your Profile.</p>
      {error.digest ? <p className="mt-4 font-mono text-xs text-muted tabular">Reference: {error.digest}</p> : null}
      <Button className="mt-8" onClick={() => retry()}>
        Try again
      </Button>
    </main>
  );
}
