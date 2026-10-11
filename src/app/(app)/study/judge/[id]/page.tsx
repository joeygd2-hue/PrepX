import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ChevronDown, MessageCircle } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { JUDGE_KINDS } from "@/server/ai/sessions";
import { features } from "@/lib/env";
import { BackHeader, Page } from "@/components/ui/page";
import { ButtonLink } from "@/components/ui/button";
import { FeedbackView } from "@/components/app/feedback-view";
import { JudgeRunner } from "./runner";

export const metadata: Metadata = { title: "Practice round" };

export default async function JudgeSession({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [s] = await db.select().from(schema.aiSessions).where(and(eq(schema.aiSessions.id, id), eq(schema.aiSessions.userId, user.id)));
  if (!s) notFound();
  const [fb] = await db.select().from(schema.aiFeedback).where(eq(schema.aiFeedback.sessionId, s.id));
  const [event] = s.eventId ? await db.select().from(schema.events).where(eq(schema.events.id, s.eventId)) : [];
  const back = s.kind.endsWith("_check") ? "/study" : "/study/judge";
  if (fb) {
    const [response] = await db.select().from(schema.aiMessages).where(and(eq(schema.aiMessages.sessionId, s.id), eq(schema.aiMessages.role, "user")));
    return (
      <Page>
        <BackHeader href={back} title={s.title} subtitle={event ? `${event.code} · ${event.name}` : undefined} />
        <FeedbackView score={fb.score} criteria={fb.criteria} summary={fb.summary} nextSteps={fb.nextSteps} rubricBasis={fb.rubricBasis} mock={features.aiIsMock()} />
        {response ? (
          <details className="group mt-3 rounded-[24px] border border-border bg-card shadow-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[24px] p-5 font-semibold tracking-[-0.01em] sm:px-6 [&::-webkit-details-marker]:hidden">
              Your response
              <ChevronDown className="size-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180" aria-hidden />
            </summary>
            <p className="whitespace-pre-wrap border-t border-border px-5 py-4 text-sm leading-relaxed text-muted sm:px-6">{response.content}</p>
          </details>
        ) : null}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/study/coach?prompt=debrief" variant="accent">
            <MessageCircle className="size-4" aria-hidden /> Debrief with coach
          </ButtonLink>
          <ButtonLink href={back} variant="outline">
            {s.kind.endsWith("_check") ? "Back to Study" : "Another round"}
          </ButtonLink>
        </div>
      </Page>
    );
  }
  if (!JUDGE_KINDS.includes(s.kind) || !event) notFound();
  const sc = s.scenario as { title: string; studentRole: string; judgeRole: string; situation: string; task: string; indicators: string[]; judgeQuestions: string[]; prepSec: number; performSec: number };
  return <JudgeRunner sessionId={s.id} face={s.kind === "face_to_face"} scenario={sc} eventLabel={`${event.code} · ${event.name}`} />;
}
