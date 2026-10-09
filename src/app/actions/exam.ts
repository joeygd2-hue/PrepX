"use server";
import { redirect } from "next/navigation";
import { userOrThrow } from "@/server/auth/session";
import { answerInstant, ExamError, isMode, saveDraft, startAttempt, submitAttempt } from "@/server/exams";
import { LimitReachedError } from "@/server/entitlements";
import { activeSelection } from "@/server/progress";

export type StartState = { error?: string; limit?: boolean } | undefined;

export async function startPracticeAction(_: StartState, form: FormData): Promise<StartState> {
  const user = await userOrThrow();
  const clusterId = String(form.get("exam") ?? "");
  const mode = form.get("mode");
  const unitId = form.get("unit") ? String(form.get("unit")) : null;
  if (!isMode(mode)) return { error: "Unknown practice mode." };
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
  try {
    return { ok: true as const, ...(await answerInstant(user.id, attemptId, questionId, choice)) };
  } catch (e) {
    if (e instanceof ExamError) return { ok: false as const, error: e.message };
    throw e;
  }
}

export async function saveDraftAction(attemptId: string, draft: Record<string, number>, elapsedSec: number) {
  const user = await userOrThrow();
  await saveDraft(user.id, attemptId, draft, elapsedSec);
}

export async function submitAction(attemptId: string, draft?: Record<string, number>, elapsedSec?: number) {
  const user = await userOrThrow();
  await submitAttempt(user.id, user.profile!.timezone, attemptId, draft, elapsedSec);
  redirect(`/study/attempt/${attemptId}/review`);
}
