import Link from "next/link";
import { env } from "@/lib/env";

export function PublicFooter() {
  return (
    <footer className="mx-auto w-full max-w-6xl px-4 pb-10 pt-16 text-sm text-muted sm:px-6">
      <p>PrepX is an independent study tool, not affiliated with or endorsed by DECA, FBLA, HOSA, TSA or any other organization.</p>
      <nav aria-label="Footer" className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {[
          ["/privacy", "Privacy"],
          ["/terms", "Terms"],
          ["/accessibility", "Accessibility"],
          ["/advisors", "Advisors"],
          ["/events", "Events"],
          ["/pricing", "Pricing"],
        ].map(([href, label], i) => (
          <span key={href} className="flex gap-3">
            {i > 0 ? <span aria-hidden>·</span> : null}
            <Link href={href} className="text-fg underline underline-offset-2">
              {label}
            </Link>
          </span>
        ))}
      </nav>
      <p className="mt-1">
        Questions?{" "}
        <a className="text-fg underline underline-offset-2" href={`mailto:${env.supportEmail}`}>
          {env.supportEmail}
        </a>{" "}
        · © {new Date().getFullYear()} PrepX
      </p>
    </footer>
  );
}

export function PublicHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 pt-8 sm:px-6">
      <Link href="/sign-in" aria-label="PrepX home">
        <LogoInline />
      </Link>
    </header>
  );
}

import { Logo } from "./logo";
function LogoInline() {
  return <Logo />;
}
