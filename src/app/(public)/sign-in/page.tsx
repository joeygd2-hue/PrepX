import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, KeyRound, Mail, Mic, Users } from "lucide-react";
import { features } from "@/lib/env";
import { getCurrentUser } from "@/server/auth/session";
import { PublicFooter, PublicHeader } from "@/components/shell/public-footer";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/form";
import { OrgBadge } from "@/components/ui/badge";
import { HeroTexture } from "@/components/ui/card";
import { Accent } from "@/components/ui/page";
import type { OrgId } from "@/lib/orgs";
import { RefCapture } from "./ref-capture";

export const metadata: Metadata = { title: "Sign in" };

const ORG_LIST: OrgId[] = ["deca", "fbla", "hosa", "tsa"];

const FEATURES = [
  { icon: KeyRound, title: "Join with a code", body: "Your advisor shares a 6-character code. You're in." },
  { icon: Users, title: "Your chapter, organized", body: "Officers, advisors and members in one place." },
  { icon: Check, title: "Check-ins and points", body: "Meeting check-ins and a chapter leaderboard." },
  { icon: Mic, title: "Practice and AI judge", body: "Practice tests, an AI coach and role-play judging." },
];

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string; ref?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { error, ref } = await searchParams;
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip">
      <span aria-hidden className="dot-grid pointer-events-none absolute inset-x-0 top-0 h-[520px] text-fg opacity-[0.07] [mask-image:radial-gradient(70%_80%_at_50%_0%,#000_20%,transparent_75%)]!" />
      {ref ? <RefCapture code={ref} /> : null}
      <PublicHeader />
      <main id="main" className="relative mx-auto grid w-full max-w-6xl flex-1 content-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:gap-x-16 lg:gap-y-0 lg:py-20">
        <section className="lg:col-start-1 lg:row-start-1">
          <ul className="flex flex-wrap gap-2" aria-label="Organizations">
            {ORG_LIST.map((o) => (
              <li key={o}>
                <OrgBadge org={o} />
              </li>
            ))}
          </ul>
          <h1 className="mt-7 text-[3.1rem] font-semibold leading-[0.98] tracking-[-0.045em] sm:text-7xl lg:text-[5.25rem]">
            Your competition season, <Accent>in one place.</Accent>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            Study for your event, check in at meetings and keep up with your chapter, all in one app built for competitive events.
          </p>
        </section>
        <section aria-labelledby="get-started" className="relative overflow-hidden rounded-[28px] bg-hero p-6 text-hero-fg shadow-float sm:p-8 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
          <HeroTexture />
          <div className="relative">
            <h2 id="get-started" className="text-[2rem] font-semibold leading-tight tracking-[-0.035em]">
              Get <Accent>started</Accent>
            </h2>
            <p className="mt-1 text-hero-muted">Use Google or your email.</p>
            {error ? (
              <Notice tone="error" className="mt-5 border-danger/40 bg-danger/15 text-hero-fg">
                {error === "google" ? "Google sign-in didn't complete. Please try again." : error === "google_unverified" ? "Your Google email isn't verified. Use email sign-in instead." : "Sign-in failed. Please try again."}
              </Notice>
            ) : null}
            <div className="mt-7 space-y-3">
              {features.google() ? (
                <ButtonLink href="/api/auth/google" variant="hero" block size="lg">
                  <GoogleG /> Continue with Google
                </ButtonLink>
              ) : (
                <p className="rounded-[14px] border border-hero-line px-4 py-3 text-sm text-hero-muted">Google sign-in isn&apos;t configured on this server yet.</p>
              )}
              <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.12em] text-hero-muted" aria-hidden>
                <span className="h-px flex-1 bg-hero-line" />
                or
                <span className="h-px flex-1 bg-hero-line" />
              </div>
              <ButtonLink href="/sign-in/email" variant="accent" block size="lg">
                <Mail className="size-5" aria-hidden /> Continue with email
              </ButtonLink>
            </div>
            <p className="mt-7 text-sm leading-relaxed text-hero-muted">
              For people 13 and older. By continuing you&apos;ll be asked to agree to our{" "}
              <Link href="/terms" className="text-hero-fg underline underline-offset-2">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-hero-fg underline underline-offset-2">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </section>
        <section aria-label="What you get" className="lg:col-start-1 lg:row-start-2">
          <ol className="grid gap-x-8 gap-y-6 border-t border-border pt-8 sm:grid-cols-2 lg:mt-10">
            {FEATURES.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="flex gap-4">
                <span className="mt-0.5 font-mono text-xs text-muted tabular" aria-hidden>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>
                  <span className="flex items-center gap-2 font-semibold tracking-[-0.01em]">
                    <Icon className="size-4" aria-hidden /> {title}
                  </span>
                  <span className="mt-1 block text-[15px] text-muted">{body}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="currentColor" d="M21.35 11.1H12v2.98h5.35c-.23 1.5-1.68 4.4-5.35 4.4-3.22 0-5.85-2.67-5.85-5.96S8.78 6.56 12 6.56c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.68 4.02 14.56 3 12 3 6.98 3 3 7.03 3 12s3.98 9 9 9c5.2 0 8.64-3.65 8.64-8.8 0-.59-.06-1.04-.29-1.1Z" />
    </svg>
  );
}
