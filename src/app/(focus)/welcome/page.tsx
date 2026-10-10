import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { Logo } from "@/components/shell/logo";
import { ButtonLink } from "@/components/ui/button";
import { Accent } from "@/components/ui/page";

export const metadata: Metadata = { title: "Welcome" };

const NEXT = [
  ["Pick your event", "A live countdown to your competition."],
  ["Follow a smart plan", "A few focused tasks a day, built around your date."],
  ["Practice out loud", "Tests, flashcards and an AI judge that talks back."],
];

export default async function Welcome() {
  const user = await requireUser({ allowIncompleteOnboarding: true });
  if (user.profile?.onboardingCompletedAt) redirect("/");
  const first = user.profile?.firstName;
  return (
    <main id="main" className="relative mx-auto flex min-h-dvh max-w-xl flex-col px-4 pb-8 pt-6 sm:px-6 sm:pt-10">
      <Logo />
      <div className="flex flex-1 flex-col justify-center py-12">
        <p className="eyebrow">Welcome</p>
        <h1 className="mt-4 text-[3rem] font-semibold leading-[0.98] tracking-[-0.045em] sm:text-6xl">
          Welcome to <Accent>PrepX</Accent>
          {first ? `, ${first}` : ""}.
        </h1>
        <p className="mt-5 text-lg text-muted">Let&apos;s get you ready for competition.</p>
        <ol className="stagger mt-10 space-y-4 border-t border-border pt-8">
          {NEXT.map(([title, body], i) => (
            <li key={title} className="flex gap-4">
              <span className="mt-0.5 font-mono text-xs text-muted tabular" aria-hidden>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>
                <span className="block font-semibold tracking-[-0.01em]">{title}</span>
                <span className="mt-0.5 block text-[15px] text-muted">{body}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <ButtonLink href="/onboarding" block size="lg">
        Continue <ArrowRight className="size-5 transition-transform group-hover/btn:translate-x-0.5" aria-hidden />
      </ButtonLink>
    </main>
  );
}
