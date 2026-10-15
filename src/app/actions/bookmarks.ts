"use server";
import { z } from "zod";
import { userOrThrow } from "@/server/auth/session";
import { rateLimit } from "@/server/ratelimit";
import * as bookmarks from "@/server/bookmarks";

export type BookmarkResult = { ok: true; bookmarked: boolean; note: string } | { ok: false; error: string };

const Input = z.object({ questionId: z.uuid(), note: z.string().max(bookmarks.NOTE_MAX * 4).optional(), bookmarked: z.boolean().optional() });
type Parsed = { questionId: string; note: string; bookmarked?: boolean };

async function run(raw: { questionId: unknown; note?: unknown; bookmarked?: unknown }, fn: (userId: string, input: Parsed) => Promise<bookmarks.BookmarkState>): Promise<BookmarkResult> {
  const user = await userOrThrow();
  const input = Input.safeParse(raw);
  if (!input.success) return { ok: false, error: input.error.issues.some((i) => i.path[0] === "note") ? `Notes can be up to ${bookmarks.NOTE_MAX.toLocaleString("en-US")} characters.` : "Question not found." };
  if (!(await rateLimit(`bookmark:${user.id}`, 120, 300))) return { ok: false, error: "You're saving very quickly. Wait a moment and try again." };
  try {
    return { ok: true, ...(await fn(user.id, { questionId: input.data.questionId, note: input.data.note ?? "", bookmarked: input.data.bookmarked })) };
  } catch (e) {
    if (e instanceof bookmarks.BookmarkError) return { ok: false, error: e.message };
    throw e;
  }
}

/** `bookmarked` is the state the student wants (omit to flip whatever is saved). */
export async function toggleBookmark(questionId: string, bookmarked?: boolean): Promise<BookmarkResult> {
  return run({ questionId, bookmarked }, (userId, i) => bookmarks.toggleBookmark(userId, i.questionId, i.bookmarked));
}

export async function saveBookmarkNote(questionId: string, note: string): Promise<BookmarkResult> {
  return run({ questionId, note }, (userId, i) => bookmarks.saveBookmarkNote(userId, i.questionId, i.note));
}

export async function removeBookmark(questionId: string): Promise<BookmarkResult> {
  return run({ questionId }, async (userId, i) => {
    await bookmarks.removeBookmark(userId, i.questionId);
    return { bookmarked: false, note: "" };
  });
}
