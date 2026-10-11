import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { ExamError, loadAttempt, MODES, type Mode } from "@/server/exams";
import { bookmarkNotes } from "@/server/bookmarks";
import { ExamRunner } from "./runner";

export const metadata: Metadata = { title: "Practice" };

export default async function AttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  let data;
  try {
    data = await loadAttempt(user.id, id);
  } catch (e) {
    if (e instanceof ExamError) notFound();
    throw e;
  }
  const a = data.attempt;
  if (a.submittedAt) redirect(`/study/attempt/${a.id}/review`);
  const mode = a.mode as Mode;
  // Bookmarks are offered after answering in instant modes (sprints move on too fast for them).
  const bookmarks = MODES[mode].instant && mode !== "sprint" ? await bookmarkNotes(user.id, a.questionIds) : {};
  // Remaining time: strict modes count from start; pausable modes use saved active time.
  const remaining = a.timeLimitSec
    ? a.allowPause
      ? a.timeLimitSec - a.elapsedSec
      : Math.max(0, a.timeLimitSec - Math.floor((Date.now() - a.startedAt.getTime()) / 1000))
    : null;
  return (
    <ExamRunner
      attemptId={a.id}
      mode={mode}
      label={MODES[mode].label}
      instant={MODES[mode].instant}
      allowPause={a.allowPause}
      questions={data.questions}
      initialDraft={a.draft}
      remainingSec={remaining}
      elapsedSec={a.elapsedSec}
      bookmarks={bookmarks}
    />
  );
}
