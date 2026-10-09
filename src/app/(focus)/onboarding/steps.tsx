"use client";
import Link from "next/link";
import { useActionState } from "react";
import { useClientValue } from "@/lib/use-client-value";
import { ArrowRight } from "lucide-react";
import { FieldError, Input, Label, Select } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { ORGS, ORG_IDS } from "@/lib/orgs";
import { US_STATES } from "@/lib/states";
import { cn } from "@/lib/cn";
import { acceptTerms, goToStep, saveAge, saveName, saveOrgs, saveSchool, type StepState } from "./actions";

type P = { firstName: string; lastName: string; displayName: string; birthDate: string | null; grade: number | null; school: string | null; orgInterests: string[] };

function StepForm({ action, title, subtitle, children, back }: { action: (s: StepState, f: FormData) => Promise<StepState>; title: string; subtitle?: string; children: React.ReactNode; back?: string }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="mt-10 flex flex-1 flex-col">
      <div className="flex-1">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        {subtitle ? <p className="mt-3 text-muted">{subtitle}</p> : null}
        <div className="mt-8 space-y-5">{children}</div>
        <FieldError>{state?.error}</FieldError>
      </div>
      <div className="mt-10 space-y-3">
        <SubmitButton block size="lg" pendingText="Saving…">
          <ArrowRight className="size-5" aria-hidden /> Continue
        </SubmitButton>
        {back ? (
          <button type="button" onClick={() => goToStep(back)} className="block w-full py-2 text-center font-medium">
            Back
          </button>
        ) : null}
      </div>
    </form>
  );
}

export function Steps({ step, profile }: { step: string; profile: P }) {
  if (step === "name")
    return (
      <StepForm action={saveName} title="What's your name?" subtitle="Your advisor and chapter will see your display name. Nothing else is public.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" name="firstName" autoComplete="given-name" defaultValue={profile.firstName} required maxLength={50} />
          </div>
          <div>
            <Label htmlFor="lastName">Last name</Label>
            <Input id="lastName" name="lastName" autoComplete="family-name" defaultValue={profile.lastName} required maxLength={50} />
          </div>
        </div>
        <div>
          <Label htmlFor="displayName">Preferred name (optional)</Label>
          <Input id="displayName" name="displayName" defaultValue={profile.displayName} maxLength={40} placeholder="What should we call you?" />
        </div>
      </StepForm>
    );
  if (step === "age")
    return (
      <StepForm action={saveAge} title="When's your birthday?" subtitle="PrepX is for people 13 and older. We use this only to confirm your age; it's never shown to anyone." back="name">
        <div>
          <Label htmlFor="birthDate">Date of birth</Label>
          <Input id="birthDate" name="birthDate" type="date" defaultValue={profile.birthDate ?? ""} required max={new Date().toISOString().slice(0, 10)} />
        </div>
        <TimezoneInput />
      </StepForm>
    );
  if (step === "school")
    return (
      <StepForm action={saveSchool} title="Where do you go to school?" subtitle="Your grade helps us suggest the right events. School and state are optional." back="age">
        <div>
          <Label htmlFor="grade">Grade</Label>
          <Select id="grade" name="grade" defaultValue={profile.grade ?? ""} required>
            <option value="" disabled>
              Choose your grade
            </option>
            {[9, 10, 11, 12].map((g) => (
              <option key={g} value={g}>
                Grade {g}
              </option>
            ))}
            <option value={8}>Grade 8 or below</option>
            <option value={13}>Graduated / other</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="school">School (optional)</Label>
          <Input id="school" name="school" defaultValue={profile.school ?? ""} maxLength={120} autoComplete="organization" />
        </div>
        <div>
          <Label htmlFor="state">State (optional)</Label>
          <Select id="state" name="state" defaultValue="">
            <option value="">Prefer not to say</option>
            {US_STATES.map(([c, n]) => (
              <option key={c} value={c}>
                {n}
              </option>
            ))}
          </Select>
        </div>
      </StepForm>
    );
  if (step === "orgs")
    return (
      <StepForm action={saveOrgs} title="Which organizations are you in?" subtitle="Pick all that apply. We'll show their events and dates." back="school">
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">Organizations</legend>
          {ORG_IDS.map((o) => (
            <label key={o} className={cn("flex cursor-pointer items-center gap-3 rounded-2xl border border-border p-4 has-[:checked]:border-fg has-[:checked]:bg-subtle")}>
              <input type="checkbox" name="org" value={o} defaultChecked={profile.orgInterests.includes(o)} className="size-5 accent-[var(--fg)]" />
              <span className="size-2.5 rounded-full" style={{ background: ORGS[o].color }} aria-hidden />
              <span>
                <span className="block font-semibold">{ORGS[o].name}</span>
                <span className="block text-sm text-muted">{ORGS[o].fullName}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </StepForm>
    );
  return (
    <StepForm action={acceptTerms} title="One last thing" subtitle="Here's how PrepX handles your information, in short:" back="orgs">
      <ul className="list-disc space-y-2 pl-5 text-muted">
        <li>We collect only what&apos;s needed to run your study tools. We never sell your data.</li>
        <li>Your email, birthday and school are never shown publicly.</li>
        <li>AI practice is processed by our AI provider to give you feedback. Voice is transcribed in your browser; we never store audio.</li>
        <li>You can download or delete your data at any time from Profile.</li>
      </ul>
      <label className="flex items-start gap-3 rounded-2xl border border-border p-4">
        <input type="checkbox" name="terms" className="mt-1 size-5 accent-[var(--fg)]" required />
        <span>
          I agree to the{" "}
          <Link href="/terms" target="_blank" className="underline underline-offset-2">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" target="_blank" className="underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </span>
      </label>
    </StepForm>
  );
}

function TimezoneInput() {
  const tz = useClientValue(() => Intl.DateTimeFormat().resolvedOptions().timeZone, "America/Chicago");
  return <input type="hidden" name="timezone" value={tz} />;
}
