import { describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { answerInstant, saveDraft, submitAttempt } from "@/server/exams";
import { createDuel, declineDuel, DuelError, duelBuddies, duelWinner, getDuel, joinDuel, listDuels, startDuel, syncDuelForAttempt, timeLeftLabel } from "@/server/duels";
import { makeUser } from "../support/factory";

const TZ = "America/Chicago";
const BANK = "deca-bac";
const DAY = 86_400_000;

async function befriend(a: string, b: string) {
  await db.insert(schema.buddies).values({ requesterId: a, addresseeId: b, status: "accepted" });
}

async function notes(userId: string, kind: string) {
  return db.select().from(schema.notifications).where(and(eq(schema.notifications.userId, userId), eq(schema.notifications.kind, kind)));
}

/** Answers a duel attempt (the first `right` questions correct, the rest wrong) and submits it. */
async function answerAndSubmit(userId: string, attemptId: string, right: number) {
  const [a] = await db.select().from(schema.examAttempts).where(eq(schema.examAttempts.id, attemptId));
  const qs = await db.select({ id: schema.questions.id, answerIndex: schema.questions.answerIndex, choices: schema.questions.choices }).from(schema.questions).where(inArray(schema.questions.id, a.questionIds));
  for (const [i, qid] of a.questionIds.entries()) {
    const q = qs.find((x) => x.id === qid)!;
    await answerInstant(userId, attemptId, qid, i < right ? q.answerIndex : (q.answerIndex + 1) % q.choices.length);
  }
  await submitAttempt(userId, TZ, attemptId);
}

/** Plays a duel attempt. Duels time a round on the server (start to submit), so `seconds` back-dates the start. */
async function play(userId: string, attemptId: string, right: number, seconds?: number) {
  await answerAndSubmit(userId, attemptId, right);
  if (seconds !== undefined) {
    const [a] = await db.select({ submittedAt: schema.examAttempts.submittedAt }).from(schema.examAttempts).where(eq(schema.examAttempts.id, attemptId));
    await db.update(schema.examAttempts).set({ startedAt: new Date(a.submittedAt!.getTime() - seconds * 1000) }).where(eq(schema.examAttempts.id, attemptId));
  }
  await syncDuelForAttempt(userId, attemptId);
}

async function duelPair() {
  const a = await makeUser({ first: "Ava" });
  const b = await makeUser({ first: "Ben" });
  const d = await createDuel({ userId: a.id, clusterId: BANK });
  await joinDuel(b.id, d.code);
  return { a, b, d };
}

describe("duel winner", () => {
  it("ranks by correct answers, then by time, else a draw", () => {
    expect(duelWinner({ correct: 8, elapsedSec: 300 }, { correct: 7, elapsedSec: 60 })).toBe("a");
    expect(duelWinner({ correct: 6, elapsedSec: 30 }, { correct: 9, elapsedSec: 400 })).toBe("b");
    expect(duelWinner({ correct: 7, elapsedSec: 95 }, { correct: 7, elapsedSec: 120 })).toBe("a");
    expect(duelWinner({ correct: 7, elapsedSec: 121 }, { correct: 7, elapsedSec: 120 })).toBe("b");
    expect(duelWinner({ correct: 5, elapsedSec: 100 }, { correct: 5, elapsedSec: 100 })).toBe("draw");
  });
});

describe("duels", () => {
  it("creates a duel on 10 random published questions and needs at least 10 in the bank", async () => {
    const a = await makeUser();
    const small = `duel-small-${Date.now()}`;
    await db.insert(schema.examClusters).values({ id: small, org: "deca", kind: "practice", code: "DS", name: "Duel small bank" });
    try {
      await db.insert(schema.questions).values(Array.from({ length: 9 }, (_, i) => ({ clusterId: small, stem: `Small bank question ${i}?`, choices: ["A", "B", "C", "D"], answerIndex: 0, explanation: "Because." })));
      await expect(createDuel({ userId: a.id, clusterId: small })).rejects.toThrow(/at least 10/);
    } finally {
      await db.delete(schema.examClusters).where(eq(schema.examClusters.id, small));
    }
    await expect(createDuel({ userId: a.id, clusterId: "no-such-bank" })).rejects.toBeInstanceOf(DuelError);
    await expect(createDuel({ userId: a.id, clusterId: "'; drop table duels; --" })).rejects.toBeInstanceOf(DuelError);

    const before = Date.now();
    const { id, code } = await createDuel({ userId: a.id, clusterId: BANK });
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    const [d] = await db.select().from(schema.duels).where(eq(schema.duels.id, id));
    expect(d).toMatchObject({ creatorId: a.id, opponentId: null, status: "open", clusterId: BANK });
    expect(new Set(d.questionIds).size).toBe(10);
    const qs = await db.select().from(schema.questions).where(inArray(schema.questions.id, d.questionIds));
    expect(qs.every((q) => q.clusterId === BANK && q.status === "published")).toBe(true);
    expect(d.expiresAt.getTime() - before).toBeGreaterThan(7 * DAY - 60_000);
    expect(d.expiresAt.getTime() - before).toBeLessThan(7 * DAY + 60_000);
  });

  it("challenges only accepted study buddies and notifies them", async () => {
    const a = await makeUser({ first: "Ava" });
    const b = await makeUser({ first: "Ben" });
    const stranger = await makeUser();
    await expect(createDuel({ userId: a.id, clusterId: BANK, opponentId: stranger.id })).rejects.toBeInstanceOf(DuelError);
    await expect(createDuel({ userId: a.id, clusterId: BANK, opponentId: a.id })).rejects.toBeInstanceOf(DuelError);
    await expect(createDuel({ userId: a.id, clusterId: BANK, opponentId: "not-a-uuid" })).rejects.toBeInstanceOf(DuelError);
    await befriend(b.id, a.id);
    expect(await duelBuddies(a.id)).toEqual([{ userId: b.id, name: "Ben" }]);

    const { id } = await createDuel({ userId: a.id, clusterId: BANK, opponentId: b.id });
    const [d] = await db.select().from(schema.duels).where(eq(schema.duels.id, id));
    expect(d).toMatchObject({ opponentId: b.id, status: "open" });
    const [n] = await notes(b.id, "duel_challenge");
    expect(n).toMatchObject({ title: "Ava challenged you to a duel", href: `/study/duels/${id}` });
    expect(n.body).not.toContain("@");
    expect((await listDuels(b.id)).yourTurn.map((x) => x.id)).toEqual([id]);

    // The buddy can decline before playing; then nobody can start it.
    await expect(declineDuel(a.id, id)).rejects.toBeInstanceOf(DuelError);
    await declineDuel(b.id, id);
    expect((await getDuel(b.id, id)).status).toBe("declined");
    await expect(startDuel({ userId: a.id, tz: TZ, duelId: id })).rejects.toThrow(/declined/);
  });

  it("joins by code: not your own, one opponent only, expired refused", async () => {
    const a = await makeUser({ first: "Ava" });
    const b = await makeUser({ first: "Ben" });
    const c = await makeUser();
    const { id, code } = await createDuel({ userId: a.id, clusterId: BANK });
    await expect(joinDuel(a.id, code)).rejects.toThrow(/your own duel/);
    await expect(joinDuel(b.id, "not a code")).rejects.toBeInstanceOf(DuelError);
    await expect(joinDuel(b.id, "ZZZZZZ")).rejects.toThrow(/couldn't find/);

    expect(await joinDuel(b.id, code.toLowerCase())).toBe(id);
    const [d] = await db.select().from(schema.duels).where(eq(schema.duels.id, id));
    expect(d).toMatchObject({ opponentId: b.id, status: "active" });
    expect(await notes(a.id, "duel_joined")).toHaveLength(1);
    // Joining again is harmless; a second challenger is refused.
    expect(await joinDuel(b.id, code)).toBe(id);
    await expect(joinDuel(c.id, code)).rejects.toThrow(/already has an opponent/);
    expect((await db.select().from(schema.duels).where(eq(schema.duels.id, id)))[0].opponentId).toBe(b.id);

    const old = await createDuel({ userId: a.id, clusterId: BANK, now: new Date(Date.now() - 8 * DAY) });
    await expect(joinDuel(c.id, old.code)).rejects.toThrow(/expired/);
  });

  it("rate-limits joining", async () => {
    const u = await makeUser();
    for (let i = 0; i < 20; i++) await expect(joinDuel(u.id, "ZZZZZZ")).rejects.toThrow(/couldn't find/);
    await expect(joinDuel(u.id, "ZZZZZZ")).rejects.toThrow(/Too many/);
  });

  it("starts a fixed-question duel attempt once per player", async () => {
    const { a, b, d } = await duelPair();
    const [duel] = await db.select().from(schema.duels).where(eq(schema.duels.id, d.id));
    const first = await startDuel({ userId: a.id, tz: TZ, duelId: d.id });
    expect(await startDuel({ userId: a.id, tz: TZ, duelId: d.id })).toBe(first);
    const [att] = await db.select().from(schema.examAttempts).where(eq(schema.examAttempts.id, first));
    expect(att).toMatchObject({ userId: a.id, mode: "duel", clusterId: BANK, questionIds: duel.questionIds });

    const second = await startDuel({ userId: b.id, tz: TZ, duelId: d.id });
    expect(second).not.toBe(first);
    const [battB] = await db.select().from(schema.examAttempts).where(eq(schema.examAttempts.id, second));
    expect(battB.questionIds).toEqual(duel.questionIds);
    const entries = await db.select().from(schema.duelEntries).where(eq(schema.duelEntries.duelId, d.id));
    expect(entries).toHaveLength(2);
    const attempts = await db.select().from(schema.examAttempts).where(and(eq(schema.examAttempts.userId, a.id), eq(schema.examAttempts.mode, "duel")));
    expect(attempts).toHaveLength(1);
    expect((await getDuel(a.id, d.id)).me).toMatchObject({ state: "playing", attemptId: first });
  });

  it("keeps scores hidden until both finish, then picks the winner and compares each question", async () => {
    const { a, b, d } = await duelPair();
    const aAttempt = await startDuel({ userId: a.id, tz: TZ, duelId: d.id });
    await play(a.id, aAttempt, 6);

    // Ben is told Ava finished, but not her score.
    expect(await notes(b.id, "duel_finished")).toHaveLength(1);
    const bView = await getDuel(b.id, d.id);
    expect(bView).toMatchObject({ status: "active", outcome: null, comparison: null, canStart: true });
    expect(bView.them).toMatchObject({ name: "Ava", state: "done", score: null });
    const aView = await getDuel(a.id, d.id);
    expect(aView.me.score).toMatchObject({ correct: 6 });
    expect(aView.them).toMatchObject({ name: "Ben", state: "new", score: null });
    expect((await listDuels(a.id)).theirTurn.map((x) => x.id)).toEqual([d.id]);
    expect((await listDuels(b.id)).yourTurn.map((x) => x.id)).toEqual([d.id]);

    const bAttempt = await startDuel({ userId: b.id, tz: TZ, duelId: d.id });
    await play(b.id, bAttempt, 8);
    expect(await notes(a.id, "duel_finished")).toHaveLength(1);
    const [row] = await db.select().from(schema.duels).where(eq(schema.duels.id, d.id));
    expect(row.status).toBe("finished");

    const final = await getDuel(a.id, d.id);
    expect(final).toMatchObject({ status: "finished", outcome: "lost", canStart: false });
    expect(final.them.score).toMatchObject({ correct: 8 });
    expect(final.comparison).toHaveLength(10);
    expect(final.comparison!.filter((q) => q.mine).length).toBe(6);
    expect(final.comparison!.filter((q) => q.theirs).length).toBe(8);
    expect(JSON.stringify(final)).not.toMatch(/@prepx\.test|answerIndex|explanation/);
    expect((await getDuel(b.id, d.id)).outcome).toBe("won");
    const [result] = (await listDuels(b.id)).results;
    expect(result).toMatchObject({ id: d.id, result: { outcome: "won", mine: 8, theirs: 6, total: 10 } });
    // Starting again after finishing just returns the same attempt.
    expect(await startDuel({ userId: a.id, tz: TZ, duelId: d.id })).toBe(aAttempt);
  });

  it("breaks a tie on score by server-measured time, and calls an exact tie a draw", async () => {
    const t = await duelPair();
    const slow = await startDuel({ userId: t.a.id, tz: TZ, duelId: t.d.id });
    // A tampered client reporting a 1-second round doesn't win the tie-break.
    await saveDraft(t.a.id, slow, {}, 1);
    await play(t.a.id, slow, 7, 140);
    await play(t.b.id, await startDuel({ userId: t.b.id, tz: TZ, duelId: t.d.id }), 7, 95);
    expect((await getDuel(t.a.id, t.d.id)).outcome).toBe("lost");
    expect((await getDuel(t.b.id, t.d.id)).outcome).toBe("won");
    expect((await getDuel(t.a.id, t.d.id)).me.score).toEqual({ correct: 7, elapsedSec: 140 });

    const e = await duelPair();
    await play(e.a.id, await startDuel({ userId: e.a.id, tz: TZ, duelId: e.d.id }), 5, 100);
    await play(e.b.id, await startDuel({ userId: e.b.id, tz: TZ, duelId: e.d.id }), 5, 100);
    expect((await getDuel(e.a.id, e.d.id)).outcome).toBe("draw");
    expect((await getDuel(e.b.id, e.d.id)).outcome).toBe("draw");
  });

  it("only the two players can see a duel", async () => {
    const { a, d } = await duelPair();
    const c = await makeUser();
    await expect(getDuel(c.id, d.id)).rejects.toThrow("Duel not found.");
    await expect(startDuel({ userId: c.id, tz: TZ, duelId: d.id })).rejects.toThrow("Duel not found.");
    await expect(declineDuel(c.id, d.id)).rejects.toThrow("Duel not found.");
    await expect(getDuel(a.id, "not-a-uuid")).rejects.toBeInstanceOf(DuelError);
    await expect(getDuel(a.id, "6f1c1c3e-8f43-4c4b-9d2a-1d2e3f4a5b6c")).rejects.toThrow("Duel not found.");
    expect(await listDuels(c.id)).toEqual({ yourTurn: [], theirTurn: [], results: [] });
    // The invite code is shown to the creator only while nobody has joined.
    expect((await getDuel(a.id, d.id)).code).toBeNull();
    const solo = await createDuel({ userId: a.id, clusterId: BANK });
    expect((await getDuel(a.id, solo.id)).code).toBe(solo.code);
  });

  it("expires unfinished duels after a week", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const created = new Date(Date.now() - 8 * DAY);
    const d = await createDuel({ userId: a.id, clusterId: BANK, now: created });
    // Ben joined in time, then the week ran out before anyone finished.
    await db.update(schema.duels).set({ opponentId: b.id, status: "active" }).where(eq(schema.duels.id, d.id));
    await expect(startDuel({ userId: b.id, tz: TZ, duelId: d.id })).rejects.toThrow(/expired/);
    const view = await getDuel(a.id, d.id);
    expect(view).toMatchObject({ status: "expired", canStart: false, outcome: null, code: null });
    expect((await db.select().from(schema.duels).where(eq(schema.duels.id, d.id)))[0].status).toBe("expired");
    const list = await listDuels(b.id);
    expect(list.yourTurn).toEqual([]);
    expect(list.results).toEqual([expect.objectContaining({ id: d.id, status: "expired", result: null })]);
  });

  it("counts a round finished in time but doesn't announce a turn on an expired duel", async () => {
    const { a, b, d } = await duelPair();
    const attempt = await startDuel({ userId: a.id, tz: TZ, duelId: d.id });
    await answerAndSubmit(a.id, attempt, 4);
    // Ava finished before the deadline; nobody looked at the duel until after it passed.
    await db.update(schema.examAttempts).set({ submittedAt: new Date(Date.now() - 2 * 60_000) }).where(eq(schema.examAttempts.id, attempt));
    await db.update(schema.duels).set({ expiresAt: new Date(Date.now() - 60_000) }).where(eq(schema.duels.id, d.id));
    const view = await getDuel(a.id, d.id);
    expect(view).toMatchObject({ status: "expired", canStart: false, timeLeft: "Ended" });
    expect(view.me.score).toMatchObject({ correct: 4 });
    expect(await notes(b.id, "duel_finished")).toHaveLength(0);
    await expect(startDuel({ userId: b.id, tz: TZ, duelId: d.id })).rejects.toThrow(/expired/);
  });

  it("labels the time left without rounding a day down to today", () => {
    const now = new Date("2026-03-07T20:00:00Z");
    const at = (h: number) => new Date(now.getTime() + h * 3_600_000);
    expect(timeLeftLabel(at(7 * 24), now)).toBe("7 days left");
    expect(timeLeftLabel(at(25), now)).toBe("2 days left");
    expect(timeLeftLabel(at(20), now)).toBe("20 hours left");
    expect(timeLeftLabel(at(0.5), now)).toBe("Ends within the hour");
    expect(timeLeftLabel(at(-1), now)).toBe("Ended");
  });
});
