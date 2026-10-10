import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { Logo } from "@/components/shell/logo";
import { cn } from "@/lib/cn";
import { Steps } from "./steps";

export const metadata: Metadata = { title: "Set up your account" };
const ORDER = ["age", "name", "school", "orgs", "terms"];

/** Google name claims waiting for the age check (set by the Google callback). */
async function prefillName() {
  const raw = (await cookies()).get("prepx_prefill_name")?.value;
  if (!raw) return null;
  try {
    const v = JSON.parse(decodeURIComponent(raw)) as { first?: unknown; last?: unknown };
    const clean = (s: unknown) => (typeof s === "string" ? s.trim().slice(0, 50) : "");
    return { first: clean(v.first), last: clean(v.last) };
  } catch {
    return null;
  }
}

export default async function Onboarding() {
  const user = await requireUser({ allowIncompleteOnboarding: true });
  const p = user.profile!;
  if (p.onboardingCompletedAt) redirect("/");
  // Nothing else is asked before the age check.
  const step = !p.birthDate ? "age" : ORDER.includes(p.onboardingStep) ? p.onboardingStep : "name";
  const idx = ORDER.indexOf(step);
  const prefill = step === "name" && !p.firstName ? await prefillName() : null;
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pb-8 pt-6 sm:px-6 sm:pt-10">
      <div className="flex items-center justify-between gap-4">
        <Logo />
        <p className="font-mono text-xs tracking-[0.12em] text-muted tabular">
          <span className="sr-only">Step </span>
          <span className="text-fg">{String(idx + 1).padStart(2, "0")}</span>
          <span aria-hidden> / </span>
          <span className="sr-only"> of </span>
          {String(ORDER.length).padStart(2, "0")}
        </p>
      </div>
      <div className="mt-6 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${ORDER.length}, minmax(0, 1fr))` }} role="progressbar" aria-label="Setup progress" aria-valuemin={1} aria-valuemax={ORDER.length} aria-valuenow={idx + 1}>
        {ORDER.map((s, i) => (
          <span key={s} className={cn("h-1 rounded-full transition-colors duration-500", i < idx ? "bg-fg" : i === idx ? "bg-accent shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--fg)_20%,transparent)]" : "bg-subtle-2")} />
        ))}
      </div>
      <Steps
        step={step}
        profile={{
          firstName: p.firstName || prefill?.first || "",
          lastName: p.lastName || prefill?.last || "",
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
