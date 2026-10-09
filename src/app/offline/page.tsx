import Link from "next/link";
import { WifiOff } from "lucide-react";

export const metadata = { title: "Offline" };
export const dynamic = "force-static";

export default function Offline() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <WifiOff className="size-10" aria-hidden />
      <h1 className="mt-4 text-2xl font-semibold">You&apos;re offline</h1>
      <p className="mt-2 text-muted">PrepX needs a connection to load your study plan and save progress. Your answers in an open exam are saved as soon as you reconnect.</p>
      <Link href="/" className="mt-6 inline-flex h-12 items-center rounded-full bg-fg px-6 font-medium text-bg">
        Try again
      </Link>
    </main>
  );
}
