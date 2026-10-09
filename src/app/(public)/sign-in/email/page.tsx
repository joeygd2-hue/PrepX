import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { PublicHeader } from "@/components/shell/public-footer";
import { BackHeader } from "@/components/ui/page";
import { EmailForm, CodeForm } from "./forms";

export const metadata: Metadata = { title: "Continue with email" };

export default async function EmailSignIn({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { step } = await searchParams;
  const pending = (await cookies()).get("prepx_pending_email")?.value;
  const codeStep = step === "code" && pending;
  return (
    <div className="min-h-dvh">
      <PublicHeader />
      <main id="main" className="mx-auto max-w-md px-4 py-12">
        <BackHeader href={codeStep ? "/sign-in/email" : "/sign-in"} />
        {codeStep ? (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">Check your email</h1>
            <p className="mt-2 text-muted">
              We sent a 6-digit code to <span className="font-medium text-fg">{pending}</span>. It expires in 10 minutes.
            </p>
            <CodeForm />
          </>
        ) : (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">Continue with email</h1>
            <p className="mt-2 text-muted">We&apos;ll email you a one-time code. No password needed.</p>
            <EmailForm />
          </>
        )}
      </main>
    </div>
  );
}
