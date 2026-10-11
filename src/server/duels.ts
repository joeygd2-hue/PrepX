import "server-only";
import { and, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { isJoinCodeShape, joinCode, normalizeJoinCode } from "@/lib/crypto";
import { ExamError, MODES, startAttempt } from "./exams";
import { notifyUsers } from "./notify";
import { rateLimit } from "./ratelimit";

/**
 * Head-to-head duels: two students answer the same fixed question list from one bank.
 * Most right wins; a tie goes to whoever finished faster; an exact tie is a draw.
 * Only the two players can read a duel, and the opponent's score and per-question marks stay
 * hidden until both have finished. Results are read from the players' own attempt rows.
 */

export const DUEL_QUESTIONS = MODES.duel.count;
export const DUEL_DAYS = 7;
export class DuelError extends Error {}

type DuelRow = typeof schema.duels.$inferSelect;
type EntryRow = typeof schema.duelEntries.$inferSelect;
export type DuelStatus = "open" | "active" | "finished" | "expired" | "declined";
export type PlayerState = "new" | "playing" | "done";
export type Outcome = "won" | "lost" | "draw";
export type DuelScore = { correct: number; elapsedSec: number };

const DuelId = z.uuid();
const ClusterId = z.string().trim().min(1).max(64).regex(/^[a-z0-9][a-z0-9_-]*$/i);
const UserId = z.uuid();

function duelId(raw: unknown) {
  const r = DuelId.safeParse(raw);
  if (!r.success) throw new DuelError("Duel not found.");
  return r.data;
}

/** Most correct wins; equal scores go to the shorter time; equal both is a draw. */
export function duelWinner(a: DuelScore, b: DuelScore): "a" | "b" | "draw" {
  if (a.correct !== b.correct) return a.correct > b.correct ? "a" : "b";
  if (a.elapsedSec !== b.elapsedSec) return a.elapsedSec < b.elapsedSec ? "a" : "b";
  return "draw";
}

const outcomeFor = (mine: DuelScore, theirs: DuelScore): Outcome => ({ a: "won", b: "lost", draw: "draw" } as const)[duelWinner(mine, theirs)];

/**
 * Time from start to submit, measured by the server. The attempt's own elapsedSec comes from the
 * browser (saveDraft accepts any value), so a duel never uses it to break a tie.
 */
function elapsedOf(a: { startedAt: Date; submittedAt: Date }) {
  return Math.max(0, Math.round((a.submittedAt.getTime() - a.startedAt.getTime()) / 1000));
}

/** "6 days left", "5 hours left", "Ends within the hour". A duration, so no time zone is involved. */
export function timeLeftLabel(expiresAt: Date, now: Date) {
  const ms = expiresAt.getTime() - now.getTime();
  if (ms <= 0) return "Ended";
  const hours = Math.ceil(ms / 3_600_000);
  if (hours > 24) return `${Math.ceil(ms / 86_400_000)} days left`;
  return hours > 1 ? `${hours} hours left` : "Ends within the hour";
}

const isPlayer = (d: DuelRow, userId: string) => d.creatorId === userId || d.opponentId === userId;
const otherPlayer = (d: DuelRow, userId: string) => (d.creatorId === userId ? d.opponentId : d.creatorId);
const stateOf = (e: EntryRow | undefined): PlayerState => (!e ? "new" : e.finishedAt ? "done" : "playing");
const scoreOf = (e: EntryRow | undefined): DuelScore | null => (e?.finishedAt ? { correct: e.correct ?? 0, elapsedSec: e.elapsedSec ?? 0 } : null);
/** The invite code is shown to the creator only while the duel is still waiting for someone to join. */
const visibleCode = (d: DuelRow, userId: string, status: DuelStatus) => (d.creatorId === userId && !d.opponentId && status === "open" ? d.code : null);

async function displayNames(userIds: string[]) {
  const ids = [...new Set(userIds)];
  if (!ids.length) return new Map<string, string>();
  const rows = await db.select({ id: schema.profiles.userId, name: schema.profiles.displayName }).from(schema.profiles).where(inArray(schema.profiles.userId, ids));
  return new Map(rows.map((r) => [r.id, r.name.trim() || "Your friend"]));
}

async function displayName(userId: string) {
  return (await displayNames([userId])).get(userId) ?? "Your friend";
}

/** Published questions in a bank (a duel needs at least DUEL_QUESTIONS). */
export async function duelBankSize(clusterId: string) {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.questions)
    .where(and(eq(schema.questions.clusterId, clusterId), eq(schema.questions.status, "published")));
  return n;
}

/** Accepted study buddies you can challenge directly (display names only). */
export async function duelBuddies(userId: string) {
  const rows = await db
    .select({ requesterId: schema.buddies.requesterId, addresseeId: schema.buddies.addresseeId })
    .from(schema.buddies)
    .where(and(eq(schema.buddies.status, "accepted"), or(eq(schema.buddies.requesterId, userId), eq(schema.buddies.addresseeId, userId))));
  const ids = rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
  const names = await displayNames(ids);
  return [...new Set(ids)].map((id) => ({ userId: id, name: names.get(id) ?? "Your friend" })).sort((a, b) => a.name.localeCompare(b.name));
}

async function isBuddy(userId: string, otherId: string) {
  const [b] = await db
    .select({ id: schema.buddies.id })
    .from(schema.buddies)
    .where(
      and(
        eq(schema.buddies.status, "accepted"),
        or(and(eq(schema.buddies.requesterId, userId), eq(schema.buddies.addresseeId, otherId)), and(eq(schema.buddies.requesterId, otherId), eq(schema.buddies.addresseeId, userId))),
      ),
    );
  return Boolean(b);
}

/** Creates a duel on DUEL_QUESTIONS random published questions of the bank, open for DUEL_DAYS. */
export async function createDuel(opts: { userId: string; clusterId: unknown; opponentId?: unknown; now?: Date }) {
  const { userId } = opts;
  const c = ClusterId.safeParse(opts.clusterId);
  if (!c.success) throw new DuelError("Exam not found.");
  const [cluster] = await db.select({ id: schema.examClusters.id, name: schema.examClusters.name }).from(schema.examClusters).where(eq(schema.examClusters.id, c.data));
  if (!cluster) throw new DuelError("Exam not found.");

  let opponentId: string | null = null;
  if (opts.opponentId !== undefined && opts.opponentId !== null && opts.opponentId !== "") {
    const o = UserId.safeParse(opts.opponentId);
    if (!o.success || o.data === userId || !(await isBuddy(userId, o.data))) throw new DuelError("You can challenge your study buddies directly, or share an invite code with anyone.");
    opponentId = o.data;
  }

  const qs = await db
    .select({ id: schema.questions.id })
    .from(schema.questions)
    .where(and(eq(schema.questions.clusterId, cluster.id), eq(schema.questions.status, "published")))
    .orderBy(sql`random()`)
    .limit(DUEL_QUESTIONS);
  if (qs.length < DUEL_QUESTIONS) throw new DuelError(`Duels need at least ${DUEL_QUESTIONS} practice questions, and this bank doesn't have that many yet. Try another bank.`);

  if (!(await rateLimit(`duel:create:${userId}`, 20, 86400))) throw new DuelError("You've started a lot of duels today. Try again tomorrow.");

  const now = opts.now ?? new Date();
  const expiresAt = new Date(now.getTime() + DUEL_DAYS * 86_400_000);
  let row: { id: string; code: string } | undefined;
  for (let i = 0; i < 6 && !row; i++) {
    [row] = await db
      .insert(schema.duels)
      .values({ clusterId: cluster.id, creatorId: userId, opponentId, code: joinCode(), questionIds: qs.map((q) => q.id), status: "open", createdAt: now, expiresAt })
      .onConflictDoNothing()
      .returning({ id: schema.duels.id, code: schema.duels.code });
  }
  if (!row) throw new DuelError("Couldn't create the duel. Please try again.");

  if (opponentId) {
    await notifyUsers([opponentId], "streakReminder", {
      kind: "duel_challenge",
      title: `${await displayName(userId)} challenged you to a duel`,
      body: `${cluster.name} · ${DUEL_QUESTIONS} questions · most right wins`,
      href: `/study/duels/${row.id}`,
      dedupeKey: `duel:${row.id}:invite`,
    });
  }
  return row;
}

/** Joins a duel by its invite code. A duel has one opponent; the creator can't join their own. */
export async function joinDuel(userId: string, rawCode: unknown, now = new Date()) {
  const code = normalizeJoinCode(typeof rawCode === "string" ? rawCode : "");
  if (!isJoinCodeShape(code)) throw new DuelError("Duel codes are 6 letters and numbers.");
  if (!(await rateLimit(`duel:join:${userId}`, 20, 3600))) throw new DuelError("Too many tries. Please wait a bit and try again.");
  const [d] = await db.select().from(schema.duels).where(eq(schema.duels.code, code));
  if (!d) throw new DuelError("We couldn't find a duel with that code.");
  if (d.creatorId === userId) throw new DuelError("That's your own duel. Share the code with a friend.");
  // Already your duel (an invited buddy, or joining twice): accept it if it's still open.
  if (d.opponentId === userId) {
    if (d.status === "open" && d.expiresAt > now) await db.update(schema.duels).set({ status: "active" }).where(and(eq(schema.duels.id, d.id), eq(schema.duels.status, "open")));
    return d.id;
  }
  if (d.status === "expired" || ((d.status === "open" || d.status === "active") && d.expiresAt <= now)) throw new DuelError("This duel has expired.");
  if (d.opponentId || d.status !== "open") throw new DuelError("This duel already has an opponent.");
  const [joined] = await db
    .update(schema.duels)
    .set({ opponentId: userId, status: "active" })
    .where(and(eq(schema.duels.id, d.id), isNull(schema.duels.opponentId), eq(schema.duels.status, "open"), gt(schema.duels.expiresAt, now)))
    .returning({ id: schema.duels.id });
  if (!joined) throw new DuelError("This duel already has an opponent.");
  await notifyUsers([d.creatorId], "streakReminder", {
    kind: "duel_joined",
    title: `${await displayName(userId)} accepted your duel`,
    body: "Same questions, most right wins.",
    href: `/study/duels/${d.id}`,
    dedupeKey: `duel:${d.id}:joined`,
  });
  return d.id;
}

type AttemptResult = { id: string; startedAt: Date; submittedAt: Date | null; correct: number | null; total: number | null };

/** Results of the given attempts, in one query. */
async function attemptResults(ids: string[]) {
  if (!ids.length) return new Map<string, AttemptResult>();
  const rows = await db
    .select({ id: schema.examAttempts.id, startedAt: schema.examAttempts.startedAt, submittedAt: schema.examAttempts.submittedAt, correct: schema.examAttempts.correct, total: schema.examAttempts.total })
    .from(schema.examAttempts)
    .where(inArray(schema.examAttempts.id, ids));
  return new Map(rows.map((r) => [r.id, r]));
}

const pendingAttemptIds = (entries: EntryRow[]) => entries.filter((e) => e.attemptId && !e.finishedAt).map((e) => e.attemptId!);

/**
 * Brings a duel up to date: copies results from submitted attempts into the entries, notifies
 * the other player when someone finishes, and settles the status (finished or expired).
 * Attempts submitted after the deadline don't count. `entries` and `attempts` can be preloaded
 * (the duel list loads them for all duels at once).
 */
async function syncDuel(d: DuelRow, opts: { entries?: EntryRow[]; attempts?: Map<string, AttemptResult>; now?: Date } = {}) {
  const now = opts.now ?? new Date();
  let entries = opts.entries ?? (await db.select().from(schema.duelEntries).where(eq(schema.duelEntries.duelId, d.id)));
  const pending = entries.filter((e) => e.attemptId && !e.finishedAt);
  const newlyDone: EntryRow[] = [];
  if (pending.length) {
    const attempts = opts.attempts ?? (await attemptResults(pendingAttemptIds(pending)));
    for (const e of pending) {
      const a = attempts.get(e.attemptId!);
      if (!a?.submittedAt || a.submittedAt > d.expiresAt) continue;
      const [row] = await db
        .update(schema.duelEntries)
        .set({ correct: a.correct ?? 0, total: a.total ?? d.questionIds.length, elapsedSec: elapsedOf({ ...a, submittedAt: a.submittedAt }), finishedAt: a.submittedAt })
        .where(and(eq(schema.duelEntries.duelId, d.id), eq(schema.duelEntries.userId, e.userId), isNull(schema.duelEntries.finishedAt)))
        .returning();
      if (row) newlyDone.push(row);
    }
    if (newlyDone.length) entries = entries.map((e) => newlyDone.find((n) => n.userId === e.userId) ?? e);
  }

  let status = d.status as DuelStatus;
  const bothDone = Boolean(d.opponentId) && [d.creatorId, d.opponentId].every((u) => entries.some((e) => e.userId === u && e.finishedAt));
  if (bothDone && status !== "finished") {
    await db.update(schema.duels).set({ status: "finished" }).where(eq(schema.duels.id, d.id));
    status = "finished";
  } else if ((status === "open" || status === "active") && d.expiresAt <= now) {
    await db.update(schema.duels).set({ status: "expired" }).where(and(eq(schema.duels.id, d.id), inArray(schema.duels.status, ["open", "active"])));
    status = "expired";
  }

  // An expired or declined duel has nothing left to play, so there's no "your turn" to announce.
  for (const e of status === "expired" || status === "declined" ? [] : newlyDone) {
    const other = otherPlayer(d, e.userId);
    if (!other) continue;
    await notifyUsers([other], "streakReminder", {
      kind: "duel_finished",
      title: `${await displayName(e.userId)} finished your duel`,
      body: status === "finished" ? "You've both played. See who won." : `Your turn: the same ${d.questionIds.length} questions, most right wins.`,
      href: `/study/duels/${d.id}`,
      dedupeKey: `duel:${d.id}:done:${e.userId}`,
    });
  }
  return { status, entries };
}

async function loadPlayerDuel(userId: string, rawId: unknown) {
  const id = duelId(rawId);
  const [d] = await db.select().from(schema.duels).where(eq(schema.duels.id, id));
  // Same answer for "doesn't exist" and "not yours" so ids can't be probed.
  if (!d || !isPlayer(d, userId)) throw new DuelError("Duel not found.");
  return d;
}

/** Everything the duel page shows. Throws DuelError for anyone but the two players. */
export async function getDuel(userId: string, rawId: unknown, now = new Date()) {
  const d = await loadPlayerDuel(userId, rawId);
  const { status, entries } = await syncDuel(d, { now });
  const otherId = otherPlayer(d, userId);
  const [names, [cluster]] = await Promise.all([
    displayNames([userId, ...(otherId ? [otherId] : [])]),
    db.select({ name: schema.examClusters.name }).from(schema.examClusters).where(eq(schema.examClusters.id, d.clusterId)),
  ]);
  const mine = entries.find((e) => e.userId === userId);
  const theirs = otherId ? entries.find((e) => e.userId === otherId) : undefined;
  const finished = status === "finished";
  const myScore = scoreOf(mine);
  const theirScore = finished ? scoreOf(theirs) : null;

  let comparison: { id: string; stem: string; mine: boolean | null; theirs: boolean | null }[] | null = null;
  if (finished && mine?.attemptId && theirs?.attemptId) {
    const [qs, answers] = await Promise.all([
      db.select({ id: schema.questions.id, stem: schema.questions.stem }).from(schema.questions).where(inArray(schema.questions.id, d.questionIds)),
      db
        .select({ attemptId: schema.attemptAnswers.attemptId, questionId: schema.attemptAnswers.questionId, correct: schema.attemptAnswers.correct })
        .from(schema.attemptAnswers)
        .where(inArray(schema.attemptAnswers.attemptId, [mine.attemptId, theirs.attemptId])),
    ]);
    const mark = (attemptId: string, qid: string) => answers.find((a) => a.attemptId === attemptId && a.questionId === qid)?.correct ?? null;
    comparison = d.questionIds.map((qid) => ({ id: qid, stem: qs.find((q) => q.id === qid)?.stem ?? "Question no longer available", mine: mark(mine.attemptId!, qid), theirs: mark(theirs.attemptId!, qid) }));
  }

  const open = status === "open" || status === "active";
  return {
    id: d.id,
    clusterId: d.clusterId,
    clusterName: cluster?.name ?? "Practice bank",
    role: d.creatorId === userId ? ("creator" as const) : ("opponent" as const),
    status,
    expiresAt: d.expiresAt,
    timeLeft: timeLeftLabel(d.expiresAt, now),
    questionCount: d.questionIds.length,
    code: visibleCode(d, userId, status),
    me: { name: names.get(userId) ?? "You", state: stateOf(mine), score: myScore, attemptId: mine?.attemptId ?? null },
    them: { joined: Boolean(otherId), name: otherId ? (names.get(otherId) ?? "Your friend") : null, state: stateOf(theirs), score: theirScore },
    outcome: finished && myScore && theirScore ? outcomeFor(myScore, theirScore) : null,
    comparison,
    canStart: open && !mine,
    canDecline: open && d.opponentId === userId && d.status === "open" && !mine,
  };
}
export type DuelView = Awaited<ReturnType<typeof getDuel>>;

/**
 * Starts your side of a duel: a fixed-question attempt on the duel's questions. One attempt
 * per player; calling again returns the same attempt instead of starting over.
 */
export async function startDuel(opts: { userId: string; tz: string; duelId: unknown; now?: Date }) {
  const { userId } = opts;
  const now = opts.now ?? new Date();
  const d = await loadPlayerDuel(userId, opts.duelId);
  const [existing] = await db.select().from(schema.duelEntries).where(and(eq(schema.duelEntries.duelId, d.id), eq(schema.duelEntries.userId, userId)));
  if (existing?.attemptId) return existing.attemptId;
  if (existing) throw new DuelError("You've already played this duel.");
  if (d.status === "finished") throw new DuelError("This duel is already finished.");
  if (d.status === "declined") throw new DuelError("This duel was declined.");
  if (d.status === "expired" || d.expiresAt <= now) throw new DuelError("This duel has expired.");

  // Claim the entry first so two quick taps can't start two attempts.
  const [claimed] = await db.insert(schema.duelEntries).values({ duelId: d.id, userId }).onConflictDoNothing().returning();
  if (!claimed) {
    const [row] = await db.select().from(schema.duelEntries).where(and(eq(schema.duelEntries.duelId, d.id), eq(schema.duelEntries.userId, userId)));
    if (row?.attemptId) return row.attemptId;
    throw new DuelError("Your duel is starting. Please try again in a moment.");
  }
  const release = () => db.delete(schema.duelEntries).where(and(eq(schema.duelEntries.duelId, d.id), eq(schema.duelEntries.userId, userId)));
  // The opponent may have declined (or the duel settled) between the read above and the claim.
  const [fresh] = await db.select({ status: schema.duels.status }).from(schema.duels).where(eq(schema.duels.id, d.id));
  if (fresh?.status !== "open" && fresh?.status !== "active") {
    await release();
    throw new DuelError(fresh?.status === "declined" ? "This duel was declined." : "This duel can't be played anymore.");
  }
  let attemptId: string;
  try {
    attemptId = await startAttempt({ userId, tz: opts.tz, clusterId: d.clusterId, mode: "duel", questionIds: d.questionIds });
  } catch (e) {
    await release();
    if (e instanceof ExamError) throw new DuelError(e.message);
    throw e;
  }
  await db.update(schema.duelEntries).set({ attemptId }).where(and(eq(schema.duelEntries.duelId, d.id), eq(schema.duelEntries.userId, userId)));
  if (d.opponentId === userId && d.status === "open") await db.update(schema.duels).set({ status: "active" }).where(and(eq(schema.duels.id, d.id), eq(schema.duels.status, "open")));
  return attemptId;
}

/** The invited buddy can turn down a challenge they haven't started. Returns the duel's bank. */
export async function declineDuel(userId: string, rawId: unknown) {
  const d = await loadPlayerDuel(userId, rawId);
  if (d.opponentId !== userId) throw new DuelError("Only the invited player can decline.");
  const [row] = await db
    .update(schema.duels)
    .set({ status: "declined" })
    .where(
      and(
        eq(schema.duels.id, d.id),
        eq(schema.duels.status, "open"),
        sql`not exists (select 1 from ${schema.duelEntries} where ${schema.duelEntries.duelId} = ${d.id} and ${schema.duelEntries.userId} = ${userId})`,
      ),
    )
    .returning({ id: schema.duels.id });
  if (!row) throw new DuelError("This duel can't be declined anymore.");
  return { clusterId: d.clusterId };
}

/** Your duels, newest first: what's waiting on you, what's waiting on them, and recent results. */
export async function listDuels(userId: string, now = new Date()) {
  const rows = await db
    .select()
    .from(schema.duels)
    .where(or(eq(schema.duels.creatorId, userId), eq(schema.duels.opponentId, userId)))
    .orderBy(desc(schema.duels.createdAt))
    .limit(40);
  if (!rows.length) return { yourTurn: [], theirTurn: [], results: [] };
  const allEntries = await db.select().from(schema.duelEntries).where(inArray(schema.duelEntries.duelId, rows.map((d) => d.id)));
  const live = new Set(rows.filter((d) => d.status === "open" || d.status === "active").map((d) => d.id));
  const otherIds = rows.map((d) => otherPlayer(d, userId)).filter((x): x is string => Boolean(x));
  const [names, clusters, attempts] = await Promise.all([
    displayNames(otherIds),
    db.select({ id: schema.examClusters.id, name: schema.examClusters.name }).from(schema.examClusters).where(inArray(schema.examClusters.id, [...new Set(rows.map((d) => d.clusterId))])),
    // One query for every unfinished attempt, instead of one per duel.
    attemptResults(pendingAttemptIds(allEntries.filter((e) => live.has(e.duelId)))),
  ]);

  const items = [];
  for (const d of rows) {
    let status = d.status as DuelStatus;
    let entries = allEntries.filter((e) => e.duelId === d.id);
    if (live.has(d.id)) ({ status, entries } = await syncDuel(d, { entries, attempts, now }));
    const otherId = otherPlayer(d, userId);
    const mine = entries.find((e) => e.userId === userId);
    const theirs = otherId ? entries.find((e) => e.userId === otherId) : undefined;
    const myScore = scoreOf(mine);
    const theirScore = status === "finished" ? scoreOf(theirs) : null;
    const open = status === "open" || status === "active";
    items.push({
      id: d.id,
      clusterId: d.clusterId,
      clusterName: clusters.find((c) => c.id === d.clusterId)?.name ?? "Practice bank",
      opponentName: otherId ? (names.get(otherId) ?? "Your friend") : null,
      code: visibleCode(d, userId, status),
      status,
      createdAt: d.createdAt,
      timeLeft: timeLeftLabel(d.expiresAt, now),
      myState: stateOf(mine),
      theirState: stateOf(theirs),
      waitingOn: open ? (stateOf(mine) === "done" ? ("them" as const) : ("you" as const)) : null,
      result: myScore && theirScore ? { outcome: outcomeFor(myScore, theirScore), mine: myScore.correct, theirs: theirScore.correct, total: mine?.total ?? d.questionIds.length } : null,
    });
  }
  return {
    yourTurn: items.filter((i) => i.waitingOn === "you"),
    theirTurn: items.filter((i) => i.waitingOn === "them"),
    results: items.filter((i) => !i.waitingOn).slice(0, 15),
  };
}
export type DuelSummary = Awaited<ReturnType<typeof listDuels>>["results"][number];

/**
 * For the attempt flow: the duel a duel-mode attempt belongs to (or null). Also settles the duel
 * so the other player is notified as soon as the attempt is submitted.
 */
export async function syncDuelForAttempt(userId: string, attemptId: string) {
  if (!DuelId.safeParse(attemptId).success) return null;
  const [row] = await db
    .select({ duel: schema.duels })
    .from(schema.duelEntries)
    .innerJoin(schema.duels, eq(schema.duels.id, schema.duelEntries.duelId))
    .where(and(eq(schema.duelEntries.userId, userId), eq(schema.duelEntries.attemptId, attemptId)));
  if (!row) return null;
  await syncDuel(row.duel);
  return row.duel.id;
}
