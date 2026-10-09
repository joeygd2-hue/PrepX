import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { Logo } from "@/components/shell/logo";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Welcome" };

export default async function Welcome() {
  const user = await requireUser({ allowIncompleteOnboarding: true });
  if (user.profile?.onboardingCompletedAt) redirect("/");
  const first = user.profile?.firstName;
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 pb-10 sm:px-6">
      <div className="flex flex-1 flex-col justify-center">
        <Logo />
        <h1 className="mt-8 text-4xl font-bold tracking-tight sm:text-5xl">Welcome to PrepX{first ? `, ${first}` : ""}.</h1>
        <p className="mt-5 text-lg text-muted">Let&apos;s get you ready for competition.</p>
      </div>
      <ButtonLink href="/onboarding" block size="lg">
        <ArrowRight className="size-5" aria-hidden /> Continue
      </ButtonLink>
    </main>
  );
}
