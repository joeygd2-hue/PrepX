import { WifiOff } from "lucide-react";
import { LogoMark } from "@/components/shell/logo";
import { ButtonLink } from "@/components/ui/button";

export const metadata = { title: "Offline" };
export const dynamic = "force-static";

export default function Offline() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 py-16 text-center">
      <span className="relative isolate inline-flex">
        <span aria-hidden className="dot-grid absolute -inset-12 -z-10 text-fg opacity-[0.14] [mask-image:radial-gradient(closest-side,#000,transparent)]!" />
        <LogoMark className="size-14 rounded-[18px] shadow-float" />
        <span aria-hidden className="absolute -bottom-2 -right-2 inline-flex size-7 items-center justify-center rounded-full border border-border bg-card text-fg shadow-card">
          <WifiOff className="size-3.5" />
        </span>
      </span>
      <h1 className="mt-10 text-balance text-[2rem] font-semibold leading-[1.05] tracking-[-0.035em]">You&apos;re offline</h1>
      <p className="mt-3 text-pretty text-muted">PrepX needs a connection to load your study plan and save progress. Your answers in an open exam are saved as soon as you reconnect.</p>
      <ButtonLink href="/" className="mt-8">
        Try again
      </ButtonLink>
    </main>
  );
}
