import Link from "next/link";
import { env } from "@/lib/env";
import { Logo } from "./logo";

export function PublicFooter() {
  return (
    <footer className="mx-auto w-full max-w-6xl px-4 pb-10 pt-16 text-sm text-muted sm:px-6">
      <div className="border-t border-border pt-8">
        <p className="max-w-2xl">PrepX is an independent study tool, not affiliated with or endorsed by DECA, FBLA, HOSA, TSA or any other organization.</p>
        <nav aria-label="Footer" className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
          {[
            ["/privacy", "Privacy"],
            ["/terms", "Terms"],
            ["/accessibility", "Accessibility"],
            ["/advisors", "Advisors"],
            ["/events", "Events"],
            ["/pricing", "Pricing"],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="text-fg underline decoration-border-strong underline-offset-4 transition-colors hover:decoration-fg">
              {label}
            </Link>
          ))}
        </nav>
        <p className="mt-4 font-mono text-xs">
          Questions?{" "}
          <a className="text-fg underline decoration-border-strong underline-offset-4" href={`mailto:${env.supportEmail}`}>
            {env.supportEmail}
          </a>{" "}
          · © {new Date().getFullYear()} PrepX
        </p>
      </div>
    </footer>
  );
}

export function PublicHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 pt-7 sm:px-6">
      <Link href="/sign-in" aria-label="PrepX home" className="rounded-xl">
        <Logo />
      </Link>
      <nav aria-label="Site" className="flex items-center gap-1 text-sm">
        <Link href="/events" className="hidden rounded-[11px] px-3 py-2 text-muted transition-colors hover:bg-subtle hover:text-fg sm:inline-block">
          Events
        </Link>
        <Link href="/advisors" className="hidden rounded-[11px] px-3 py-2 text-muted transition-colors hover:bg-subtle hover:text-fg sm:inline-block">
          Advisors
        </Link>
        <Link href="/pricing" className="rounded-[11px] px-3 py-2 text-muted transition-colors hover:bg-subtle hover:text-fg">
          Pricing
        </Link>
      </nav>
    </header>
  );
}
