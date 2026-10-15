import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { BookmarkError, bookmarkBanks, bookmarkNotes, listBookmarks, removeBookmark, saveBookmarkNote, toggleBookmark } from "@/server/bookmarks";
import { answerInstant, ExamError, loadAttempt, startAttempt } from "@/server/exams";
import { makeUser } from "../support/factory";

const TZ = "America/Chicago";

async function published(clusterId: string, n: number) {
  const rows = await db
    .select({ id: schema.questions.id })
    .from(schema.questions)
    .where(and(eq(schema.questions.clusterId, clusterId), eq(schema.questions.status, "published")))
    .orderBy(schema.questions.id)
    .limit(n);
  return rows.map((r) => r.id);
}

/** Records a submitted attempt with these questions, so their answers count as already seen. */
async function seen(userId: string, clusterId: string, ids: string[]) {
  await db.insert(schema.examAttempts).values({ userId, clusterId, mode: "quick10", questionIds: ids, submittedAt: new Date(), correct: 0, total: ids.length });
  return ids;
}

describe("question bookmarks", () => {
  it("toggles a bookmark, saves and edits a private note, and removes it", async () => {
    const u = await makeUser();
    const [q1, q2] = await seen(u.id, "deca-bac", await published("deca-bac", 2));
    expect(await toggleBookmark(u.id, q1)).toEqual({ bookmarked: true, note: "" });
    expect(await bookmarkNotes(u.id, [q1, q2])).toEqual({ [q1]: "" });
    expect(await toggleBookmark(u.id, q1)).toEqual({ bookmarked: false, note: "" });
    expect(await bookmarkNotes(u.id, [q1])).toEqual({});

    // Saving a note bookmarks the question; notes are trimmed and editable.
    expect(await saveBookmarkNote(u.id, q2, "  Profit = revenue − expenses  ")).toEqual({ bookmarked: true, note: "Profit = revenue − expenses" });
    expect(await saveBookmarkNote(u.id, q2, "Remember the formula")).toEqual({ bookmarked: true, note: "Remember the formula" });
    const list = await listBookmarks(u.id, "deca-bac");
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: q2, note: "Remember the formula" });
    expect(list[0].explanation.length).toBeGreaterThan(5);
    expect(await bookmarkBanks(u.id)).toEqual([expect.objectContaining({ id: "deca-bac", count: 1 })]);

    expect(await removeBookmark(u.id, q2)).toBe(true);
    expect(await removeBookmark(u.id, q2)).toBe(false);
    expect(await listBookmarks(u.id, "deca-bac")).toEqual([]);
  });

  it("sets the wanted state, so a stale screen never deletes a saved note", async () => {
    const u = await makeUser();
    const [q] = await seen(u.id, "deca-bac", await published("deca-bac", 1));
    await saveBookmarkNote(u.id, q, "keep me");
    // The screen still shows "not bookmarked" and the student taps to save it: nothing is lost.
    expect(await toggleBookmark(u.id, q, true)).toEqual({ bookmarked: true, note: "keep me" });
    expect(await toggleBookmark(u.id, q, false)).toEqual({ bookmarked: false, note: "" });
    expect(await toggleBookmark(u.id, q, false)).toEqual({ bookmarked: false, note: "" });
    expect(await bookmarkNotes(u.id, [q])).toEqual({});
    expect(await toggleBookmark(u.id, q, true)).toEqual({ bookmarked: true, note: "" });
  });

  it("limits notes to 1,000 characters", async () => {
    const u = await makeUser();
    const [q] = await seen(u.id, "deca-bac", await published("deca-bac", 1));
    expect((await saveBookmarkNote(u.id, q, "x".repeat(1000))).note).toHaveLength(1000);
    await expect(saveBookmarkNote(u.id, q, "y".repeat(1001))).rejects.toBeInstanceOf(BookmarkError);
    const [row] = await db.select().from(schema.questionBookmarks).where(and(eq(schema.questionBookmarks.userId, u.id), eq(schema.questionBookmarks.questionId, q)));
    expect(row.note).toBe("x".repeat(1000));
  });

  it("keeps each student's bookmarks and notes private", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const [q] = await published("deca-bac", 1);
    await seen(a.id, "deca-bac", [q]);
    await seen(b.id, "deca-bac", [q]);
    await saveBookmarkNote(a.id, q, "A's secret mnemonic");
    expect(await listBookmarks(b.id, "deca-bac")).toEqual([]);
    expect(await bookmarkNotes(b.id, [q])).toEqual({});
    // B acting on the same question only ever touches B's own row.
    expect(await removeBookmark(b.id, q)).toBe(false);
    expect(await toggleBookmark(b.id, q)).toEqual({ bookmarked: true, note: "" });
    await saveBookmarkNote(b.id, q, "B's note");
    await toggleBookmark(b.id, q);
    expect(await bookmarkNotes(a.id, [q])).toEqual({ [q]: "A's secret mnemonic" });
  });

  it("only saves questions whose answer the student has already seen", async () => {
    const u = await makeUser();
    const id = await startAttempt({ userId: u.id, tz: TZ, clusterId: "deca-bac", mode: "quick10" });
    const [first] = (await loadAttempt(u.id, id)).questions;
    // Mid-attempt, before answering: saving it would reveal the answer on the Bookmarks page.
    await expect(toggleBookmark(u.id, first.id, true)).rejects.toThrow(/Answer this question first/);
    await expect(saveBookmarkNote(u.id, first.id, "peek")).rejects.toBeInstanceOf(BookmarkError);
    await answerInstant(u.id, id, first.id, 0);
    expect(await toggleBookmark(u.id, first.id, true)).toEqual({ bookmarked: true, note: "" });
  });

  it("refuses malformed ids and questions that aren't published", async () => {
    const u = await makeUser();
    await expect(toggleBookmark(u.id, "not-a-uuid")).rejects.toBeInstanceOf(BookmarkError);
    await expect(toggleBookmark(u.id, "6f1c1c3e-8f43-4c4b-9d2a-1d2e3f4a5b6c")).rejects.toBeInstanceOf(BookmarkError);
    const [draft] = await db
      .insert(schema.questions)
      .values({ clusterId: "deca-bac", stem: "Draft question under review?", choices: ["A", "B", "C", "D"], answerIndex: 0, explanation: "Not yet reviewed.", status: "review" })
      .returning({ id: schema.questions.id });
    try {
      await expect(toggleBookmark(u.id, draft.id)).rejects.toBeInstanceOf(BookmarkError);
      await expect(saveBookmarkNote(u.id, draft.id, "note")).rejects.toBeInstanceOf(BookmarkError);
    } finally {
      await db.delete(schema.questions).where(eq(schema.questions.id, draft.id));
    }
  });
});

describe("bookmarks practice mode", () => {
  it("asks the student to bookmark something first when there's nothing saved", async () => {
    const u = await makeUser();
    const [other] = await seen(u.id, "hosa-mm", await published("hosa-mm", 1));
    await toggleBookmark(u.id, other);
    await expect(startAttempt({ userId: u.id, tz: TZ, clusterId: "deca-bac", mode: "bookmarks" })).rejects.toThrow(/bookmarked any questions/);
    await expect(startAttempt({ userId: u.id, tz: TZ, clusterId: "deca-bac", mode: "bookmarks" })).rejects.toBeInstanceOf(ExamError);
  });

  it("practices only this bank's bookmarked questions, up to 20", async () => {
    const u = await makeUser();
    const few = await seen(u.id, "deca-bac", await published("deca-bac", 3));
    for (const id of few) await toggleBookmark(u.id, id);
    const [other] = await seen(u.id, "hosa-mm", await published("hosa-mm", 1));
    await toggleBookmark(u.id, other);
    const id = await startAttempt({ userId: u.id, tz: TZ, clusterId: "deca-bac", mode: "bookmarks" });
    const { attempt, questions } = await loadAttempt(u.id, id);
    expect(attempt.mode).toBe("bookmarks");
    expect([...attempt.questionIds].sort()).toEqual([...few].sort());
    expect(questions[0].answered).toBeNull();

    const v = await makeUser();
    const many = await seen(v.id, "deca-bac", await published("deca-bac", 25));
    for (const q of many) await toggleBookmark(v.id, q);
    const big = (await loadAttempt(v.id, await startAttempt({ userId: v.id, tz: TZ, clusterId: "deca-bac", mode: "bookmarks" }))).attempt.questionIds;
    expect(big).toHaveLength(20);
    expect(new Set(big).size).toBe(20);
    expect(big.every((q) => many.includes(q))).toBe(true);
  });
});
