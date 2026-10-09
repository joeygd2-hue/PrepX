import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { ChapterError, membership, requireChapterRole } from "./chapters";

export async function createGame(hostId: string, chapterId: string, clusterId: string, count = 10, seconds = 20) {
  await requireChapterRole(hostId, chapterId, "officer");
  const qs = await db
    .select({ id: schema.questions.id })
    .from(schema.questions)
    .where(and(eq(schema.questions.clusterId, clusterId), eq(schema.questions.status, "published")))
    .orderBy(sql`random()`)
    .limit(Math.min(Math.max(count, 3), 30));
  if (qs.length < 3) throw new ChapterError("That exam doesn't have enough questions for a quiz yet.");
  const [g] = await db
    .insert(schema.quizGames)
    .values({ chapterId, hostId, clusterId, questionIds: qs.map((q) => q.id), secondsPerQuestion: Math.min(Math.max(seconds, 10), 60) })
    .returning();
  return g;
}

async function loadGame(userId: string, gameId: string) {
  const [g] = await db.select().from(schema.quizGames).where(eq(schema.quizGames.id, gameId));
  if (!g) throw new ChapterError("Game not found.");
  const m = await membership(userId, g.chapterId);
  if (!m) throw new ChapterError("You're not in this chapter.");
  return { g, m };
}

export async function advanceGame(hostId: string, gameId: string) {
  const { g, m } = await loadGame(hostId, gameId);
  if (m.role === "member") throw new ChapterError("Only the host can control the game.");
  if (g.status === "lobby" || g.status === "reveal") {
    const next = g.currentIndex + 1;
    if (next >= g.questionIds.length) return finishGame(g.id, g.chapterId);
    await db.update(schema.quizGames).set({ status: "live", currentIndex: next, questionStartedAt: new Date() }).where(eq(schema.quizGames.id, g.id));
  } else if (g.status === "live") {
    await db.update(schema.quizGames).set({ status: "reveal" }).where(eq(schema.quizGames.id, g.id));
  }
}

async function finishGame(gameId: string, chapterId: string) {
  await db.update(schema.quizGames).set({ status: "ended" }).where(eq(schema.quizGames.id, gameId));
  // Chapter points: one per correct answer.
  const rows = await db
    .select({ userId: schema.quizAnswers.userId, correct: sql<number>`count(*) filter (where ${schema.quizAnswers.correct})::int` })
    .from(schema.quizAnswers)
    .where(eq(schema.quizAnswers.gameId, gameId))
    .groupBy(schema.quizAnswers.userId);
  for (const r of rows)
    if (r.correct)
      await db
        .update(schema.chapterMembers)
        .set({ points: sql`${schema.chapterMembers.points} + ${r.correct}` })
        .where(and(eq(schema.chapterMembers.chapterId, chapterId), eq(schema.chapterMembers.userId, r.userId)));
}

export async function answerGame(userId: string, gameId: string, index: number, choice: number) {
  const { g } = await loadGame(userId, gameId);
  if (g.status !== "live" || g.currentIndex !== index || !g.questionStartedAt) throw new ChapterError("Too late for this question.");
  const elapsed = (Date.now() - g.questionStartedAt.getTime()) / 1000;
  if (elapsed > g.secondsPerQuestion + 1) throw new ChapterError("Time's up for this question.");
  const [q] = await db.select().from(schema.questions).where(eq(schema.questions.id, g.questionIds[index]));
  const correct = q.answerIndex === choice;
  const points = correct ? 500 + Math.round(500 * Math.max(0, 1 - elapsed / g.secondsPerQuestion)) : 0;
  await db.insert(schema.quizAnswers).values({ gameId, userId, questionIndex: index, chosenIndex: choice, correct, points }).onConflictDoNothing();
}

export async function gameState(userId: string, gameId: string) {
  const { g, m } = await loadGame(userId, gameId);
  const [chapter] = await db.select({ name: schema.chapters.name }).from(schema.chapters).where(eq(schema.chapters.id, g.chapterId));
  const isHost = m.role !== "member";
  let question: { stem: string; choices: string[]; answerIndex?: number; explanation?: string } | null = null;
  let counts: number[] | null = null;
  if (g.currentIndex >= 0 && g.status !== "lobby") {
    const [q] = await db.select().from(schema.questions).where(eq(schema.questions.id, g.questionIds[g.currentIndex]));
    question = { stem: q.stem, choices: q.choices };
    if (g.status === "reveal" || g.status === "ended") {
      question.answerIndex = q.answerIndex;
      question.explanation = q.explanation;
      const c = await db
        .select({ chosen: schema.quizAnswers.chosenIndex, n: sql<number>`count(*)::int` })
        .from(schema.quizAnswers)
        .where(and(eq(schema.quizAnswers.gameId, g.id), eq(schema.quizAnswers.questionIndex, g.currentIndex)))
        .groupBy(schema.quizAnswers.chosenIndex);
      counts = q.choices.map((_, i) => c.find((x) => x.chosen === i)?.n ?? 0);
    }
  }
  const board = await db
    .select({ userId: schema.quizAnswers.userId, name: schema.profiles.displayName, first: schema.profiles.firstName, score: sql<number>`sum(${schema.quizAnswers.points})::int` })
    .from(schema.quizAnswers)
    .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.quizAnswers.userId))
    .where(eq(schema.quizAnswers.gameId, g.id))
    .groupBy(schema.quizAnswers.userId, schema.profiles.displayName, schema.profiles.firstName)
    .orderBy(desc(sql`sum(${schema.quizAnswers.points})`))
    .limit(10);
  const [mine] = await db
    .select()
    .from(schema.quizAnswers)
    .where(and(eq(schema.quizAnswers.gameId, g.id), eq(schema.quizAnswers.userId, userId), eq(schema.quizAnswers.questionIndex, g.currentIndex)));
  const [{ players }] = await db.select({ players: sql<number>`count(distinct ${schema.quizAnswers.userId})::int` }).from(schema.quizAnswers).where(eq(schema.quizAnswers.gameId, g.id));
  return {
    id: g.id,
    chapterName: chapter?.name ?? "",
    status: g.status,
    index: g.currentIndex,
    total: g.questionIds.length,
    secondsLeft: g.status === "live" && g.questionStartedAt ? Math.max(0, Math.ceil(g.secondsPerQuestion - (Date.now() - g.questionStartedAt.getTime()) / 1000)) : null,
    question,
    counts,
    myAnswer: mine ? { chosen: mine.chosenIndex, correct: g.status !== "live" ? mine.correct : null, points: g.status !== "live" ? mine.points : null } : null,
    board: board.map((b) => ({ name: b.name || b.first, score: b.score, you: b.userId === userId })),
    players,
    isHost,
  };
}
