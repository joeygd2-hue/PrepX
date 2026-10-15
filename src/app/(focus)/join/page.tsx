import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { Accent } from "@/components/ui/page";
import { JoinForm } from "./form";

export const metadata: Metadata = { title: "Join a chapter" };

export default async function Join({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const user = await requireUser();
  const { code } = await searchParams;
  return (
    <main id="main" className="mx-auto max-w-xl px-4 pb-16 pt-10 sm:px-6 sm:pt-16">
      <span className="inline-flex size-14 items-center justify-center rounded-[18px] bg-hero text-hero-fg shadow-float" aria-hidden>
        <KeyRound className="size-6" />
      </span>
      <h1 className="mt-7 text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.04em] sm:text-5xl">
        Join a <Accent>chapter</Accent>
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">
        Get the code from your advisor or a board member. You can be in one chapter per competition, like your school&apos;s DECA chapter and its FBLA chapter.
      </p>
      <JoinForm initial={code ?? ""} sharing={user.profile!.shareActivityWithChapter} />
    </main>
  );
}
