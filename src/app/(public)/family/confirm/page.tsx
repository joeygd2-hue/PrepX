import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { sha256 } from "@/lib/crypto";
import { PublicPage } from "@/components/shell/public-page";
import { ConfirmButton } from "./confirm";

export const metadata: Metadata = { title: "Confirm monthly email", robots: { index: false } };

export default async function Confirm({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const [link] = token ? await db.select().from(schema.familyLinks).where(eq(schema.familyLinks.tokenHash, sha256(token))) : [];
  const [student] = link ? await db.select({ first: schema.profiles.firstName }).from(schema.profiles).where(eq(schema.profiles.userId, link.studentId)) : [];
  return (
    <PublicPage>
      {!link ? (
        <>
          <h1 className="text-3xl font-semibold">This link isn&apos;t valid</h1>
          <p className="mt-3 text-muted">It may have expired or been replaced by a newer invite. Ask the student to send a new one from their Profile.</p>
        </>
      ) : link.status === "confirmed" ? (
        <>
          <h1 className="text-3xl font-semibold">You&apos;re all set</h1>
          <p className="mt-3 text-muted">You&apos;ll receive a monthly progress email for {student?.first ?? "your student"}.</p>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-semibold">Get a monthly progress email for {student?.first ?? "your student"}?</h1>
          <p className="mt-3 text-muted">
            Once a month we&apos;ll email: days practiced, study streak, practice-test accuracy and practice judge scores. You won&apos;t see messages, AI conversations or written work.
            You or the student can stop it anytime.
          </p>
          <ConfirmButton token={token!} />
        </>
      )}
    </PublicPage>
  );
}
