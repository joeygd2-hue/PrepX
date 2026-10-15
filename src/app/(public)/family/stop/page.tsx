import type { Metadata } from "next";
import { MailX } from "lucide-react";
import { PublicPage } from "@/components/shell/public-page";
import { Accent } from "@/components/ui/page";
import { Notice } from "@/components/ui/form";
import { StopButton } from "./stop";

export const metadata: Metadata = { title: "Stop monthly email", robots: { index: false } };

export default async function Stop({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <PublicPage narrow>
      <span aria-hidden className="mb-7 inline-flex size-14 items-center justify-center rounded-[18px] bg-hero text-hero-fg shadow-float">
        <MailX className="size-6" />
      </span>
      <div>
        <h1 className="text-[2.35rem] font-semibold leading-[1.05] tracking-[-0.04em]">
          Stop monthly progress <Accent>emails</Accent>?
        </h1>
        <p className="mt-4 text-pretty text-lg leading-relaxed text-muted">You won&apos;t receive any more PrepX progress emails for this student. They can invite you again later.</p>
        {token ? <StopButton token={token} /> : <Notice className="mt-8">This link is missing its token.</Notice>}
      </div>
    </PublicPage>
  );
}
