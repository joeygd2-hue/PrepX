import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { ProgressBar } from "@/components/ui/progress";
import { Steps } from "./steps";

export const metadata: Metadata = { title: "Set up your account" };
const ORDER = ["name", "age", "school", "orgs", "terms"];

export default async function Onboarding() {
  const user = await requireUser({ allowIncompleteOnboarding: true });
  const p = user.profile!;
  if (p.onboardingCompletedAt) redirect("/");
  const step = ORDER.includes(p.onboardingStep) ? p.onboardingStep : "name";
  const idx = ORDER.indexOf(step);
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 pb-10 pt-8 sm:px-6">
      <p className="eyebrow mb-3">
        Step {idx + 1} of {ORDER.length}
      </p>
      <ProgressBar value={idx + 1} max={ORDER.length} label="Setup progress" />
      <Steps
        step={step}
        profile={{
          firstName: p.firstName,
          lastName: p.lastName,
          displayName: p.displayName,
          birthDate: p.birthDate,
          grade: p.grade,
          school: p.school,
          orgInterests: p.orgInterests,
        }}
      />
    </main>
  );
}
