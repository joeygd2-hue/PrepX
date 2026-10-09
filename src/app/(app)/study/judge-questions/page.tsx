import type { Metadata } from "next";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { activeSelection } from "@/server/progress";
import { getAllowance } from "@/server/entitlements";
import { BackHeader, Page } from "@/components/ui/page";
import { Notice } from "@/components/ui/form";
import { features } from "@/lib/env";
import { QuestionsDrill } from "./drill";

export const metadata: Metadata = { title: "Judge questions" };

export default async function JudgeQuestions() {
  const user = await requireUser();
  const sel = await activeSelection(user.id);
  const [latest] = sel
    ? await db
        .select()
        .from(schema.aiSessions)
        .where(and(eq(schema.aiSessions.userId, user.id), eq(schema.aiSessions.kind, "judge_questions"), eq(schema.aiSessions.eventId, sel.event.id)))
        .orderBy(desc(schema.aiSessions.createdAt))
        .limit(1)
    : [];
  const allowance = await getAllowance(user.id, "judge_questions", user.profile!.timezone);
  const sc = latest?.scenario as { questions: string[]; answers: Record<string, { answer: string; rating: number; feedback: string; strongerAnswer: string }> } | undefined;
  return (
    <Page>
      <BackHeader href="/study" title="Judge questions" subtitle={sel ? `${sel.event.code} · ${sel.event.name}` : undefined} />
      {!sel ? <Notice>Choose your event first.</Notice> : null}
      {!features.ai() ? <Notice tone="warning">AI features aren&apos;t configured on this server yet.</Notice> : null}
      {sel ? (
        <QuestionsDrill
          sessionId={latest?.id ?? null}
          questions={sc?.questions ?? []}
          answers={sc?.answers ?? {}}
          remaining={allowance.unlimited ? null : allowance.remaining}
          resets={allowance.resets}
        />
      ) : null}
    </Page>
  );
}
