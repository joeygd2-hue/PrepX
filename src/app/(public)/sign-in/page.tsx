import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, KeyRound, Mail, Mic, Users } from "lucide-react";
import { features } from "@/lib/env";
import { getCurrentUser } from "@/server/auth/session";
import { PublicFooter, PublicHeader } from "@/components/shell/public-footer";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/form";
import { RefCapture } from "./ref-capture";

export const metadata: Metadata = { title: "Sign in" };

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
    <div className="flex min-h-dvh flex-col">
      {ref ? <RefCapture code={ref} /> : null}
      <PublicHeader />
      <main id="main" className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[1.25fr_1fr] lg:py-20">
        <section>
          <p className="eyebrow mb-5">DECA · FBLA · HOSA · TSA</p>
          <h1 className="text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">Your competition season, in one place.</h1>
          <p className="mt-6 max-w-xl text-lg text-muted">
            Study for your event, check in at meetings and keep up with your chapter, all in one app built for competitive events.
          </p>
          <ul className="mt-10 grid gap-6 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-subtle" aria-hidden>
                  <Icon className="size-5" />
                </span>
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="mt-1 block text-muted">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="get-started" className="rounded-3xl border border-border p-6 sm:p-8">
          <h2 id="get-started" className="text-3xl font-semibold tracking-tight">
            Get started
          </h2>
          <p className="mt-1 text-muted">Use Google or your email.</p>
          {error ? (
            <Notice tone="error" className="mt-4">
              {error === "google" ? "Google sign-in didn't complete. Please try again." : error === "google_unverified" ? "Your Google email isn't verified. Use email sign-in instead." : "Sign-in failed. Please try again."}
            </Notice>
          ) : null}
          <div className="mt-6 space-y-3">
            {features.google() ? (
              <ButtonLink href="/api/auth/google" block size="lg">
                <GoogleG /> Continue with Google
              </ButtonLink>
            ) : (
              <p className="rounded-2xl bg-subtle px-4 py-3 text-sm text-muted">Google sign-in isn&apos;t configured on this server yet.</p>
            )}
            <div className="flex items-center gap-3 text-xs text-muted" aria-hidden>
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>
            <ButtonLink href="/sign-in/email" variant="outline" block size="lg">
              <Mail className="size-5" aria-hidden /> Continue with email
            </ButtonLink>
          </div>
          <p className="mt-6 text-sm text-muted">
            For people 13 and older. By continuing you&apos;ll be asked to agree to our{" "}
            <Link href="/terms" className="text-fg underline underline-offset-2">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-fg underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </p>
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
