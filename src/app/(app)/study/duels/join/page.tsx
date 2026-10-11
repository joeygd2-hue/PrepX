import type { Metadata } from "next";
import { requireUser } from "@/server/auth/session";
import { normalizeJoinCode } from "@/lib/crypto";
import { DUEL_QUESTIONS } from "@/server/duels";
import { BackHeader, Page } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { JoinForm } from "../duel-forms";

export const metadata: Metadata = { title: "Join a duel" };

export default async function JoinDuelPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  await requireUser();
  const { code } = await searchParams;
  const initial = typeof code === "string" ? normalizeJoinCode(code).slice(0, 6) : "";
  return (
    <Page>
      <BackHeader href="/study/duels" title="Join a duel" subtitle={`Same ${DUEL_QUESTIONS} questions as a friend · most right wins`} />
      <Card>
        <p className="text-lg font-semibold tracking-[-0.02em]">Enter your friend&apos;s code</p>
        <p className="mt-1 text-sm text-muted">Codes are 6 letters and numbers. Each duel has one opponent and closes after a week.</p>
        <JoinForm initialCode={initial} className="mt-5" />
      </Card>
    </Page>
  );
}
