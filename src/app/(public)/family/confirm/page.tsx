import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { Mail, MailCheck, Unlink } from "lucide-react";
import { db, schema } from "@/db";
import { sha256 } from "@/lib/crypto";
import { PublicPage } from "@/components/shell/public-page";
import { Accent } from "@/components/ui/page";
import { ConfirmButton } from "./confirm";

export const metadata: Metadata = { title: "Confirm monthly email", robots: { index: false } };

export default async function Confirm({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const [link] = token ? await db.select().from(schema.familyLinks).where(eq(schema.familyLinks.tokenHash, sha256(token))) : [];
  const [student] = link ? await db.select({ first: schema.profiles.firstName }).from(schema.profiles).where(eq(schema.profiles.userId, link.studentId)) : [];
  const Icon = !link ? Unlink : link.status === "confirmed" ? MailCheck : Mail;
  return (
    <PublicPage narrow>
      <span aria-hidden className="mb-7 inline-flex size-14 items-center justify-center rounded-[18px] bg-hero text-hero-fg shadow-float">
        <Icon className="size-6" />
      </span>
      {!link ? (
        <div>
          <h1 className="text-[2.35rem] font-semibold leading-[1.05] tracking-[-0.04em]">
            This link isn&apos;t <Accent>valid</Accent>
          </h1>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted">It may have expired or been replaced by a newer invite. Ask the student to send a new one from their Profile.</p>
        </div>
      ) : link.status === "confirmed" ? (
        <div>
          <h1 className="text-[2.35rem] font-semibold leading-[1.05] tracking-[-0.04em]">
            You&apos;re all <Accent>set</Accent>
          </h1>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted">You&apos;ll receive a monthly progress email for {student?.first ?? "your student"}.</p>
        </div>
      ) : (
        <div>
          <h1 className="break-words text-[2.35rem] font-semibold leading-[1.05] tracking-[-0.04em]">
            Get a monthly progress email for <Accent>{student?.first ?? "your student"}</Accent>?
          </h1>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted">
            Once a month we&apos;ll email: days practiced, study streak, practice-test accuracy and practice judge scores. You won&apos;t see messages, AI conversations or written work.
            You or the student can stop it anytime.
          </p>
          <ConfirmButton token={token!} />
        </div>
      )}
    </PublicPage>
  );
}
