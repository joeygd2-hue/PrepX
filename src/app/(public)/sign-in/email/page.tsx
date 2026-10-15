import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { PublicHeader } from "@/components/shell/public-footer";
import { KeyRound, Mail } from "lucide-react";
import { Accent, BackHeader } from "@/components/ui/page";
import { EmailForm, CodeForm } from "./forms";

export const metadata: Metadata = { title: "Continue with email" };

export default async function EmailSignIn({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { step } = await searchParams;
  const pending = (await cookies()).get("prepx_pending_email")?.value;
  const codeStep = step === "code" && pending;
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main id="main" className="mx-auto w-full max-w-md flex-1 px-4 py-10 sm:py-16">
        <BackHeader href={codeStep ? "/sign-in/email" : "/sign-in"} />
        <span aria-hidden className="mb-7 inline-flex size-14 items-center justify-center rounded-[18px] bg-hero text-hero-fg shadow-float">
          {codeStep ? <KeyRound className="size-6" /> : <Mail className="size-6" />}
        </span>
        {codeStep ? (
          <>
            <h1 className="text-[2.35rem] font-semibold leading-[1.05] tracking-[-0.04em]">
              Check your <Accent>email</Accent>
            </h1>
            <p className="mt-3 text-muted">
              We sent a 6-digit code to <span className="font-medium text-fg">{pending}</span>. It expires in 10 minutes.
            </p>
            <CodeForm />
          </>
        ) : (
          <>
            <h1 className="text-[2.35rem] font-semibold leading-[1.05] tracking-[-0.04em]">
              Continue with <Accent>email</Accent>
            </h1>
            <p className="mt-3 text-muted">We&apos;ll email you a one-time code. No password needed.</p>
            <EmailForm />
          </>
        )}
      </main>
    </div>
  );
}
