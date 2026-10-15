"use server";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { userOrThrow } from "@/server/auth/session";
import { awardXp, recordActivity, syncAchievements } from "@/server/progress";
import { autoCompleteTask } from "@/server/dashboard";
import { XP } from "@/lib/levels";
import { todayIn } from "@/lib/dates";

const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30];

/** Leitner boxes: "know" moves up a box (longer interval); "again" drops to box 1. */
export async function reviewCard(cardId: string, result: "know" | "again") {
  const user = await userOrThrow();
  const [card] = await db.select({ id: schema.flashcards.id }).from(schema.flashcards).where(eq(schema.flashcards.id, cardId));
  if (!card) return;
  const [cur] = await db.select().from(schema.flashcardReviews).where(and(eq(schema.flashcardReviews.userId, user.id), eq(schema.flashcardReviews.cardId, cardId)));
  const box = result === "know" ? Math.min((cur?.box ?? 1) + 1, 5) : 1;
  const dueAt = new Date(Date.now() + INTERVAL_DAYS[box] * 86400_000);
  await db
    .insert(schema.flashcardReviews)
    .values({ userId: user.id, cardId, box, reviews: 1, lastReviewedAt: new Date(), dueAt })
    .onConflictDoUpdate({
      target: [schema.flashcardReviews.userId, schema.flashcardReviews.cardId],
      set: { box, reviews: sql`${schema.flashcardReviews.reviews} + 1`, lastReviewedAt: new Date(), dueAt },
    });
}

export async function toggleDifficult(cardId: string, difficult: boolean) {
  const user = await userOrThrow();
  await db
    .insert(schema.flashcardReviews)
    .values({ userId: user.id, cardId, difficult })
    .onConflictDoUpdate({ target: [schema.flashcardReviews.userId, schema.flashcardReviews.cardId], set: { difficult } });
}

export async function finishFlashcardSession(reviewed: number) {
  const user = await userOrThrow();
  if (reviewed < 5) return;
  const tz = user.profile!.timezone;
  await recordActivity(user.id, tz);
  await awardXp(user.id, XP.flashcardSession, "flashcards", todayIn(tz));
  await autoCompleteTask(user.id, tz, ["flashcards"]);
  await syncAchievements(user.id, tz);
}
