import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { JoinForm } from "./form";

export const metadata: Metadata = { title: "Join a chapter" };

export default async function Join({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  await requireUser();
  const { code } = await searchParams;
  return (
    <main id="main" className="mx-auto max-w-2xl px-4 pt-12 pb-16 sm:px-6">
      <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-fg text-bg" aria-hidden>
        <KeyRound className="size-6" />
      </span>
      <h1 className="mt-6 text-4xl font-bold tracking-tight">Join a chapter</h1>
      <p className="mt-4 text-lg text-muted">
        Get the code from your advisor or a board member. You can be in one chapter per competition, like your school&apos;s DECA chapter and its FBLA chapter.
      </p>
      <JoinForm initial={code ?? ""} />
    </main>
  );
}
