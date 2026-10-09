"use server";
import { redirect } from "next/navigation";
import { userOrThrow } from "@/server/auth/session";
import { ChapterError } from "@/server/chapters";
import { advanceGame, answerGame, createGame } from "@/server/quiz";

export async function createGameAction(_: { error?: string } | undefined, form: FormData) {
  const user = await userOrThrow();
  let id: string;
  try {
    const g = await createGame(user.id, String(form.get("chapterId")), String(form.get("clusterId")), Number(form.get("count") ?? 10), Number(form.get("seconds") ?? 20));
    id = g.id;
  } catch (e) {
    if (e instanceof ChapterError) return { error: e.message };
    throw e;
  }
  redirect(`/chapter/quiz/${id}`);
}

export async function advanceAction(gameId: string) {
  const user = await userOrThrow();
  try {
    await advanceGame(user.id, gameId);
    return { ok: true };
  } catch (e) {
    if (e instanceof ChapterError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function quizAnswerAction(gameId: string, index: number, choice: number) {
  const user = await userOrThrow();
  try {
    await answerGame(user.id, gameId, index, choice);
    return { ok: true };
  } catch (e) {
    if (e instanceof ChapterError) return { ok: false, error: e.message };
    throw e;
  }
}
