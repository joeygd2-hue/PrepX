"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { userOrThrow } from "@/server/auth/session";
import { answerInstant, ExamError, isMode, saveDraft, startAttempt, submitAttempt } from "@/server/exams";
import { LimitReachedError } from "@/server/entitlements";
import { activeSelection } from "@/server/progress";

export type StartState = { error?: string; limit?: boolean } | undefined;

const Slug = z.string().trim().min(1).max(100);
const Start = z.object({ exam: Slug, mode: z.string(), unit: Slug.nullable() });
const AttemptId = z.uuid();
const Answer = z.object({ attemptId: AttemptId, questionId: z.uuid(), choice: z.number().int().min(0).max(5) });
const Draft = z.record(z.string().max(64), z.number());
const Elapsed = z.number().finite().min(0).max(1e6);

export async function startPracticeAction(_: StartState, form: FormData): Promise<StartState> {
  const user = await userOrThrow();
  const input = Start.safeParse({ exam: form.get("exam") ?? "", mode: form.get("mode") ?? "", unit: form.get("unit") || null });
  if (!input.success) return { error: "That practice bank wasn't found." };
  const { exam: clusterId, mode, unit: unitId } = input.data;
  // Duels start from the Duels page with a fixed question list, never from this form.
  if (!isMode(mode) || mode === "duel") return { error: "Unknown practice mode." };
  let id: string;
  try {
    const sel = await activeSelection(user.id);
    id = await startAttempt({ userId: user.id, tz: user.profile!.timezone, clusterId, mode, unitId, eventId: sel?.event.components.exam?.clusterId === clusterId ? sel.event.id : null });
  } catch (e) {
    if (e instanceof LimitReachedError) return { error: `You've used your full practice exams for this season on the free plan. ${e.resetsLabel}.`, limit: true };
    if (e instanceof ExamError) return { error: e.message };
    throw e;
  }
  redirect(`/study/attempt/${id}`);
}

export async function answerAction(attemptId: string, questionId: string, choice: number) {
  const user = await userOrThrow();
  const input = Answer.safeParse({ attemptId, questionId, choice });
  if (!input.success) return { ok: false as const, error: "That answer couldn't be saved. Refresh the page and try again." };
  try {
    return { ok: true as const, ...(await answerInstant(user.id, input.data.attemptId, input.data.questionId, input.data.choice)) };
  } catch (e) {
    if (e instanceof ExamError) return { ok: false as const, error: e.message };
    throw e;
  }
}

export async function saveDraftAction(attemptId: string, draft: Record<string, number>, elapsedSec: number) {
  const user = await userOrThrow();
  const d = Draft.safeParse(draft);
  const t = Elapsed.safeParse(elapsedSec);
  if (!AttemptId.safeParse(attemptId).success || !d.success || !t.success) return;
  await saveDraft(user.id, attemptId, d.data, t.data);
}

export async function submitAction(attemptId: string, draft?: Record<string, number>, elapsedSec?: number) {
  const user = await userOrThrow();
  if (!AttemptId.safeParse(attemptId).success) redirect("/study");
  const d = Draft.optional().safeParse(draft);
  const t = Elapsed.optional().safeParse(elapsedSec);
  await submitAttempt(user.id, user.profile!.timezone, attemptId, d.success ? d.data : undefined, t.success ? t.data : undefined);
  redirect(`/study/attempt/${attemptId}/review`);
}
