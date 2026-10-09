import "server-only";
import { and, desc, eq, gte, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { addDays, todayIn } from "@/lib/dates";
import { levelFor } from "@/lib/levels";
import { currentStreak, longestStreak } from "@/lib/streaks";
import { ACHIEVEMENTS, earnedAchievements } from "@/lib/achievements";
import { eventShape, readiness, type PlanStats } from "@/lib/plan";

export async function awardXp(userId: string, amount: number, reason: string, refId: string) {
  if (amount <= 0) return;
  await db.insert(schema.xpEvents).values({ userId, amount, reason, refId }).onConflictDoNothing();
}

export async function recordActivity(userId: string, tz: string) {
  await db.insert(schema.activityDays).values({ userId, day: todayIn(tz) }).onConflictDoNothing();
}

export async function xpSummary(userId: string, tz: string) {
  const weekStart = addDays(todayIn(tz), -6);
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${schema.xpEvents.amount}),0)::int`,
      week: sql<number>`coalesce(sum(${schema.xpEvents.amount}) filter (where ${schema.xpEvents.createdAt} >= ${weekStart}::date),0)::int`,
    })
    .from(schema.xpEvents)
    .where(eq(schema.xpEvents.userId, userId));
  return { total: row.total, week: row.week, level: levelFor(row.total) };
}

export async function streakSummary(userId: string, tz: string) {
  const rows = await db.select({ day: schema.activityDays.day }).from(schema.activityDays).where(eq(schema.activityDays.userId, userId));
  const days = rows.map((r) => r.day);
  const today = todayIn(tz);
  const last14 = days.filter((d) => d > addDays(today, -14)).length;
  return { current: currentStreak(days, today), longest: longestStreak(days), activeLast14: last14, practicedToday: days.includes(today) };
}

/** Exam statistics for one cluster. */
export async function examStats(userId: string, clusterId: string) {
  const answers = await db
    .select({ correct: schema.attemptAnswers.correct })
    .from(schema.attemptAnswers)
    .innerJoin(schema.examAttempts, eq(schema.examAttempts.id, schema.attemptAnswers.attemptId))
    .where(and(eq(schema.attemptAnswers.userId, userId), eq(schema.examAttempts.clusterId, clusterId)))
    .orderBy(desc(schema.attemptAnswers.answeredAt))
    .limit(100);
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(schema.attemptAnswers)
    .innerJoin(schema.examAttempts, eq(schema.examAttempts.id, schema.attemptAnswers.attemptId))
    .where(and(eq(schema.attemptAnswers.userId, userId), eq(schema.examAttempts.clusterId, clusterId)));
  const correct = answers.filter((a) => a.correct).length;
  return { answered: total, last100Count: answers.length, last100Accuracy: answers.length ? correct / answers.length : null };
}

export async function unitMastery(userId: string, clusterId: string) {
  const units = await db.select().from(schema.units).where(eq(schema.units.clusterId, clusterId)).orderBy(schema.units.position);
  const progress = await db.select().from(schema.lessonProgress).where(eq(schema.lessonProgress.userId, userId));
  const pmap = new Map(progress.map((p) => [p.unitId, p]));
  // Mastery: >= 80% on the last 15+ questions answered from that unit.
  const recent = await db.execute<{ unit_id: string; n: number; correct: number }>(sql`
    select unit_id, count(*)::int as n, sum(case when correct then 1 else 0 end)::int as correct from (
      select q.unit_id, a.correct, row_number() over (partition by q.unit_id order by a.answered_at desc) as rn
      from attempt_answers a join questions q on q.id = a.question_id
      where a.user_id = ${userId} and q.cluster_id = ${clusterId}
    ) t where rn <= 20 group by unit_id`);
  const rmap = new Map(recent.map((r) => [r.unit_id, r]));
  return units.map((u) => {
    const p = pmap.get(u.id);
    const r = rmap.get(u.id);
    const mastered = Boolean(r && r.n >= 15 && r.correct / r.n >= 0.8);
    const status = mastered ? "Mastered" : p?.lessonCompletedAt ? "Lesson done" : p ? "In progress" : "Not started";
    return { unit: u, status, mastered, lessonDone: Boolean(p?.lessonCompletedAt), recentAnswered: r?.n ?? 0, recentAccuracy: r && r.n ? r.correct / r.n : null };
  });
}

export async function judgeScores(userId: string, eventId?: string) {
  const rows = await db
    .select({ score: schema.aiFeedback.score, createdAt: schema.aiFeedback.createdAt })
    .from(schema.aiFeedback)
    .innerJoin(schema.aiSessions, eq(schema.aiSessions.id, schema.aiFeedback.sessionId))
    .where(
      and(
        eq(schema.aiFeedback.userId, userId),
        inArray(schema.aiSessions.kind, ["judge", "face_to_face", "presentation_check"]),
        eventId ? eq(schema.aiFeedback.eventId, eventId) : undefined,
      ),
    )
    .orderBy(desc(schema.aiFeedback.createdAt));
  return rows.map((r) => r.score);
}

async function countSessions(userId: string, kinds: string[], eventId?: string) {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.aiSessions)
    .where(and(eq(schema.aiSessions.userId, userId), inArray(schema.aiSessions.kind, kinds), eventId ? eq(schema.aiSessions.eventId, eventId) : undefined));
  return n;
}

export async function planStats(userId: string, event: typeof schema.events.$inferSelect, tz: string): Promise<{ stats: PlanStats; shape: ReturnType<typeof eventShape> }> {
  const clusterId = event.components.exam?.clusterId;
  const [bank] = clusterId
    ? await db.select({ n: sql<number>`count(*)::int` }).from(schema.questions).where(and(eq(schema.questions.clusterId, clusterId), eq(schema.questions.status, "published")))
    : [{ n: 0 }];
  const shape = eventShape(event.components, bank.n > 0);
  const ex = clusterId ? await examStats(userId, clusterId) : { answered: 0, last100Count: 0, last100Accuracy: null };
  const mastery = clusterId ? await unitMastery(userId, clusterId) : [];
  const weekAgo = new Date(Date.now() - 7 * 86400_000);
  const [{ fullExams, rehearsals }] = clusterId
    ? await db
        .select({
          fullExams: sql<number>`count(*) filter (where ${schema.examAttempts.mode} in ('full','rehearsal'))::int`,
          rehearsals: sql<number>`count(*) filter (where ${schema.examAttempts.mode} = 'rehearsal' and ${schema.examAttempts.submittedAt} >= ${weekAgo})::int`,
        })
        .from(schema.examAttempts)
        .where(and(eq(schema.examAttempts.userId, userId), eq(schema.examAttempts.clusterId, clusterId), isNotNull(schema.examAttempts.submittedAt)))
    : [{ fullExams: 0, rehearsals: 0 }];
  const scores = await judgeScores(userId, event.id);
  const streak = await streakSummary(userId, tz);
  const base = {
    lessonsCompleted: mastery.filter((m) => m.lessonDone).length,
    totalLessons: mastery.length,
    questionsAnswered: ex.answered,
    last100Accuracy: ex.last100Accuracy,
    last100Count: ex.last100Count,
    fullExams,
    judgeRuns: await countScored(userId, ["judge", "face_to_face"], event.id),
    judgeScoresRecent: scores,
    rehearsalsLast7Days: rehearsals,
    activeDaysLast14: streak.activeLast14,
    presentationChecks: await countScored(userId, ["presentation_check"], event.id),
    entryChecks: await countScored(userId, ["entry_check"], event.id),
    coachSessions: await countSessions(userId, ["coach"], event.id),
  };
  const r = readiness(shape, base);
  return { stats: { ...base, readiness: r.score }, shape };
}

async function countScored(userId: string, kinds: string[], eventId: string) {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.aiSessions)
    .where(and(eq(schema.aiSessions.userId, userId), inArray(schema.aiSessions.kind, kinds), eq(schema.aiSessions.eventId, eventId), eq(schema.aiSessions.status, "scored")));
  return n;
}

/** Recomputes achievements and notifies on new unlocks. Server-validated: only counts stored activity. */
export async function syncAchievements(userId: string, tz: string) {
  const streak = await streakSummary(userId, tz);
  const [{ answered }] = await db.select({ answered: sql<number>`count(*)::int` }).from(schema.attemptAnswers).where(eq(schema.attemptAnswers.userId, userId));
  const [{ lessons }] = await db
    .select({ lessons: sql<number>`count(*)::int` })
    .from(schema.lessonProgress)
    .where(and(eq(schema.lessonProgress.userId, userId), isNotNull(schema.lessonProgress.lessonCompletedAt)));
  const [{ exams }] = await db
    .select({ exams: sql<number>`count(*)::int` })
    .from(schema.examAttempts)
    .where(and(eq(schema.examAttempts.userId, userId), inArray(schema.examAttempts.mode, ["full", "rehearsal"]), isNotNull(schema.examAttempts.submittedAt)));
  const [{ judges }] = await db
    .select({ judges: sql<number>`count(*)::int` })
    .from(schema.aiSessions)
    .where(and(eq(schema.aiSessions.userId, userId), inArray(schema.aiSessions.kind, ["judge", "face_to_face"]), eq(schema.aiSessions.status, "scored")));
  const [{ referrals }] = await db
    .select({ referrals: sql<number>`count(distinct ${schema.profiles.userId})::int` })
    .from(schema.profiles)
    .innerJoin(schema.activityDays, eq(schema.activityDays.userId, schema.profiles.userId))
    .where(eq(schema.profiles.referredBy, userId));
  const [planDone] = await db
    .select({ id: schema.userAchievements.achievementId })
    .from(schema.userAchievements)
    .where(and(eq(schema.userAchievements.userId, userId), eq(schema.userAchievements.achievementId, "plan-finisher")));
  const earned = earnedAchievements({
    longestStreak: streak.longest,
    questionsAnswered: answered,
    lessonsCompleted: lessons,
    judgeRuns: judges,
    examsSubmitted: exams,
    planComplete: Boolean(planDone),
    referralsActive: referrals,
  });
  if (!earned.length) return [];
  const inserted = await db
    .insert(schema.userAchievements)
    .values(earned.map((achievementId) => ({ userId, achievementId })))
    .onConflictDoNothing()
    .returning({ id: schema.userAchievements.achievementId });
  for (const { id } of inserted) {
    const a = ACHIEVEMENTS.find((x) => x.id === id)!;
    await db
      .insert(schema.notifications)
      .values({ userId, kind: "achievement", title: `Badge unlocked: ${a.label}`, body: a.description, href: "/profile#achievements", dedupeKey: `ach:${id}` })
      .onConflictDoNothing();
  }
  return inserted.map((r) => r.id);
}

/** Active event for an organization, or for the user's focus organization when omitted. */
export async function activeSelection(userId: string, org?: "deca" | "fbla" | "hosa" | "tsa" | null) {
  const rows = await db
    .select({ sel: schema.eventSelections, event: schema.events })
    .from(schema.eventSelections)
    .innerJoin(schema.events, eq(schema.events.id, schema.eventSelections.eventId))
    .where(and(eq(schema.eventSelections.userId, userId), eq(schema.eventSelections.active, true)))
    .orderBy(desc(schema.eventSelections.selectedAt));
  if (org) return rows.find((r) => r.sel.org === org) ?? null;
  const [p] = await db.select({ focus: schema.profiles.focusOrg }).from(schema.profiles).where(eq(schema.profiles.userId, userId));
  return rows.find((r) => r.sel.org === p?.focus) ?? rows[0] ?? null;
}

export async function openMistakes(userId: string, clusterId: string) {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.mistakes)
    .innerJoin(schema.questions, eq(schema.questions.id, schema.mistakes.questionId))
    .where(and(eq(schema.mistakes.userId, userId), isNull(schema.mistakes.clearedAt), eq(schema.questions.clusterId, clusterId)));
  return n;
}

export async function recentActivitySince(userId: string, since: Date) {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.attemptAnswers).where(and(eq(schema.attemptAnswers.userId, userId), gte(schema.attemptAnswers.answeredAt, since)));
  return n;
}
