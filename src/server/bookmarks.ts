import "server-only";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";

/** Saved questions with private notes. Every query is scoped to the signed-in student's own rows. */

export const NOTE_MAX = 1000;
export class BookmarkError extends Error {}

const QuestionId = z.uuid();
const Note = z.string().trim().max(NOTE_MAX, `Notes can be up to ${NOTE_MAX.toLocaleString("en-US")} characters.`);

export type BookmarkState = { bookmarked: boolean; note: string };

function questionId(raw: unknown) {
  const r = QuestionId.safeParse(raw);
  if (!r.success) throw new BookmarkError("Question not found.");
  return r.data;
}

export function parseNote(raw: unknown) {
  const r = Note.safeParse(typeof raw === "string" ? raw : "");
  if (!r.success) throw new BookmarkError(r.error.issues[0]?.message ?? "That note can't be saved.");
  return r.data;
}

/**
 * Only published bank questions can be saved (drafts under review and retired items can't), and
 * only once the student has seen the answer: they answered it, or it was in an attempt they
 * submitted (whose review shows it). The Bookmarks page shows answers, so this keeps it from
 * revealing them in the middle of an exam or a duel.
 */
async function assertBookmarkable(userId: string, id: string) {
  const [q] = await db
    .select({ id: schema.questions.id })
    .from(schema.questions)
    .where(and(eq(schema.questions.id, id), eq(schema.questions.status, "published")));
  if (!q) throw new BookmarkError("This question is no longer available.");
  const [answered] = await db
    .select({ id: schema.attemptAnswers.questionId })
    .from(schema.attemptAnswers)
    .where(and(eq(schema.attemptAnswers.userId, userId), eq(schema.attemptAnswers.questionId, id)))
    .limit(1);
  if (answered) return;
  const [reviewed] = await db
    .select({ id: schema.examAttempts.id })
    .from(schema.examAttempts)
    .where(and(eq(schema.examAttempts.userId, userId), isNotNull(schema.examAttempts.submittedAt), sql`${schema.examAttempts.questionIds} @> ${JSON.stringify([id])}::jsonb`))
    .limit(1);
  if (!reviewed) throw new BookmarkError("Answer this question first, then you can bookmark it.");
}

async function current(userId: string, id: string) {
  const [row] = await db
    .select({ note: schema.questionBookmarks.note })
    .from(schema.questionBookmarks)
    .where(and(eq(schema.questionBookmarks.userId, userId), eq(schema.questionBookmarks.questionId, id)));
  return row ?? null;
}

/**
 * Flips the bookmark, or sets it to `want` when given. Clients pass the state they want so a stale
 * screen (another tab, a page restored from history) can never delete a bookmark and its note
 * when the student meant to save it.
 */
export async function toggleBookmark(userId: string, rawQuestionId: unknown, want?: boolean): Promise<BookmarkState> {
  const id = questionId(rawQuestionId);
  const existing = await current(userId, id);
  if (!(want ?? !existing)) {
    if (existing) await removeBookmark(userId, id);
    return { bookmarked: false, note: "" };
  }
  if (existing) return { bookmarked: true, note: existing.note };
  await assertBookmarkable(userId, id);
  await db.insert(schema.questionBookmarks).values({ userId, questionId: id }).onConflictDoNothing();
  return { bookmarked: true, note: (await current(userId, id))?.note ?? "" };
}

/** Saves (or clears) the private note, bookmarking the question if it isn't yet. */
export async function saveBookmarkNote(userId: string, rawQuestionId: unknown, rawNote: unknown): Promise<BookmarkState> {
  const id = questionId(rawQuestionId);
  const note = parseNote(rawNote);
  if (!(await current(userId, id))) await assertBookmarkable(userId, id);
  await db
    .insert(schema.questionBookmarks)
    .values({ userId, questionId: id, note })
    .onConflictDoUpdate({ target: [schema.questionBookmarks.userId, schema.questionBookmarks.questionId], set: { note, updatedAt: new Date() } });
  return { bookmarked: true, note };
}

export async function removeBookmark(userId: string, rawQuestionId: unknown) {
  const id = questionId(rawQuestionId);
  const gone = await db
    .delete(schema.questionBookmarks)
    .where(and(eq(schema.questionBookmarks.userId, userId), eq(schema.questionBookmarks.questionId, id)))
    .returning({ id: schema.questionBookmarks.questionId });
  return gone.length > 0;
}

/** Bookmark notes for the given questions, keyed by question id (missing = not bookmarked). */
export async function bookmarkNotes(userId: string, questionIds: string[]): Promise<Record<string, string>> {
  if (!questionIds.length) return {};
  const rows = await db
    .select({ id: schema.questionBookmarks.questionId, note: schema.questionBookmarks.note })
    .from(schema.questionBookmarks)
    .where(and(eq(schema.questionBookmarks.userId, userId), inArray(schema.questionBookmarks.questionId, questionIds)));
  return Object.fromEntries(rows.map((r) => [r.id, r.note]));
}

/** Safety cap for one bank's list (banks hold a few hundred questions at most). */
const LIST_MAX = 500;

/** The student's saved questions in one bank, newest first. */
export async function listBookmarks(userId: string, clusterId: string) {
  return db
    .select({
      id: schema.questions.id,
      stem: schema.questions.stem,
      choices: schema.questions.choices,
      answerIndex: schema.questions.answerIndex,
      explanation: schema.questions.explanation,
      source: schema.questions.source,
      unitTitle: schema.units.title,
      note: schema.questionBookmarks.note,
      savedAt: schema.questionBookmarks.createdAt,
    })
    .from(schema.questionBookmarks)
    .innerJoin(schema.questions, eq(schema.questions.id, schema.questionBookmarks.questionId))
    .leftJoin(schema.units, eq(schema.units.id, schema.questions.unitId))
    .where(and(eq(schema.questionBookmarks.userId, userId), eq(schema.questions.clusterId, clusterId), eq(schema.questions.status, "published")))
    .orderBy(desc(schema.questionBookmarks.createdAt), schema.questions.id)
    .limit(LIST_MAX);
}

/** Banks the student has saved questions in, with counts (for /study/bookmarks without a bank). */
export async function bookmarkBanks(userId: string) {
  return db
    .select({ id: schema.examClusters.id, name: schema.examClusters.name, count: sql<number>`count(*)::int` })
    .from(schema.questionBookmarks)
    .innerJoin(schema.questions, eq(schema.questions.id, schema.questionBookmarks.questionId))
    .innerJoin(schema.examClusters, eq(schema.examClusters.id, schema.questions.clusterId))
    .where(and(eq(schema.questionBookmarks.userId, userId), eq(schema.questions.status, "published")))
    .groupBy(schema.examClusters.id, schema.examClusters.name)
    .orderBy(schema.examClusters.name);
}
