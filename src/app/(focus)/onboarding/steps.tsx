"use client";
import Link from "next/link";
import { useActionState } from "react";
import { useClientValue } from "@/lib/use-client-value";
import { ArrowLeft, ArrowRight, Check, Lock } from "lucide-react";
import { FieldError, Input, Label, Select } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Accent } from "@/components/ui/page";
import { ORGS, ORG_IDS } from "@/lib/orgs";
import { US_STATES } from "@/lib/states";
import { cn } from "@/lib/cn";
import { acceptTerms, goToStep, saveAge, saveName, saveOrgs, saveSchool, type StepState } from "./actions";

type P = { firstName: string; lastName: string; displayName: string; birthDate: string | null; grade: number | null; school: string | null; orgInterests: string[] };

const option =
  "flex cursor-pointer items-center gap-3 rounded-[16px] border border-border bg-card p-4 shadow-card transition-[border-color,box-shadow] duration-200 hover:border-border-strong has-[:checked]:border-fg has-[:checked]:ring-4 has-[:checked]:ring-accent/30";
const checkbox = "size-5 shrink-0 accent-[var(--fg)]";

function StepForm({
  action,
  eyebrow,
  title,
  subtitle,
  children,
  back,
}: {
  action: (s: StepState, f: FormData) => Promise<StepState>;
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: string;
  children: React.ReactNode;
  back?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="stagger mt-12 flex flex-1 flex-col sm:mt-16">
      <div className="flex-1">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-3 text-[2.35rem] font-semibold leading-[1.02] tracking-[-0.04em] sm:text-5xl">{title}</h1>
        {subtitle ? <p className="mt-4 max-w-lg text-muted">{subtitle}</p> : null}
        <div className="mt-9 space-y-5">{children}</div>
        <FieldError>{state?.error}</FieldError>
      </div>
      <div className="mt-10 flex items-center gap-3">
        {back ? (
          <button
            type="button"
            onClick={() => goToStep(back)}
            aria-label="Back"
            className="inline-flex size-14 shrink-0 items-center justify-center rounded-[14px] border border-border-strong bg-card text-fg transition-colors hover:bg-subtle"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </button>
        ) : null}
        <SubmitButton block size="lg" pendingText="Saving…">
          Continue <ArrowRight className="size-5 transition-transform group-hover/btn:translate-x-0.5" aria-hidden />
        </SubmitButton>
      </div>
    </form>
  );
}

export function Steps({ step, profile }: { step: string; profile: P }) {
  if (step === "age")
    return (
      <StepForm
        action={saveAge}
        eyebrow="First, a quick check"
        title={
          <>
            When&apos;s your <Accent>birthday</Accent>?
          </>
        }
        subtitle="PrepX is for people 13 and older. We use this only to confirm your age; it's never shown to anyone."
      >
        <div>
          <Label htmlFor="birthDate">Date of birth</Label>
          <Input id="birthDate" name="birthDate" type="date" defaultValue={profile.birthDate ?? ""} required max={new Date().toISOString().slice(0, 10)} className="font-mono" />
        </div>
        <p className="flex items-center gap-2 text-sm text-muted">
          <Lock className="size-4 shrink-0" aria-hidden /> Private to you. Not shared with your chapter or anyone else.
        </p>
        <TimezoneInput />
      </StepForm>
    );
  if (step === "name")
    return (
      <StepForm
        action={saveName}
        eyebrow="About you"
        title={
          <>
            What&apos;s your <Accent>name</Accent>?
          </>
        }
        subtitle="Your advisor and chapter will see your display name. Nothing else is public."
        back="age"
      >
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
  if (step === "school")
    return (
      <StepForm
        action={saveSchool}
        eyebrow="Your school"
        title={
          <>
            Where do you go to <Accent>school</Accent>?
          </>
        }
        subtitle="Your grade helps us suggest the right events. School and state are optional."
        back="name"
      >
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
      <StepForm
        action={saveOrgs}
        eyebrow="Your organizations"
        title={
          <>
            Which <Accent>organizations</Accent> are you in?
          </>
        }
        subtitle="Pick all that apply. We'll show their events and dates."
        back="school"
      >
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">Organizations</legend>
          {ORG_IDS.map((o) => (
            <label key={o} className={option}>
              <input type="checkbox" name="org" value={o} defaultChecked={profile.orgInterests.includes(o)} className={checkbox} />
              <span className="min-w-0">
                <span className="flex items-center gap-2 font-semibold tracking-[-0.01em]">
                  <span className="size-2 rounded-full" style={{ background: `var(--${o})` }} aria-hidden />
                  {ORGS[o].name}
                </span>
                <span className="mt-0.5 block text-sm text-muted">{ORGS[o].fullName}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </StepForm>
    );
  return (
    <StepForm
      action={acceptTerms}
      eyebrow="Almost there"
      title={
        <>
          One last <Accent>thing</Accent>
        </>
      }
      subtitle="Here's how PrepX handles your information, in short:"
      back="orgs"
    >
      <ul className="space-y-3 text-[15px]">
        {[
          "We collect only what's needed to run your study tools. We never sell your data.",
          "Your email, birthday and school are never shown publicly.",
          "AI practice is processed by our AI provider to give you feedback. Voice is transcribed in your browser; we never store audio.",
          "You can download or delete your data at any time from Profile.",
        ].map((t) => (
          <li key={t} className="flex gap-3">
            <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg" aria-hidden>
              <Check className="size-3" strokeWidth={3} />
            </span>
            <span className="text-muted">{t}</span>
          </li>
        ))}
      </ul>
      <label className={cn(option, "items-start")}>
        <input type="checkbox" name="terms" className={cn(checkbox, "mt-0.5")} required />
        <span>
          I agree to the{" "}
          <Link href="/terms" target="_blank" className="font-medium underline underline-offset-2">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" target="_blank" className="font-medium underline underline-offset-2">
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
