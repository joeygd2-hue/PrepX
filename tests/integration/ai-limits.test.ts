import { beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CurrentUser } from "@/server/auth/session";
import { answerJudgeQuestion, submitJudgeRun } from "@/app/actions/ai";
import { makeUser } from "../support/factory";

// Server actions read the signed-in user from the request; tests set it directly.
const auth = vi.hoisted(() => ({ user: null as CurrentUser | null }));
vi.mock("@/server/auth/session", () => ({
  userOrThrow: async () => {
    if (!auth.user) throw new Error("Not signed in");
    return auth.user;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

// Count model calls, and let a test hold the judge's evaluation open to force an overlap.
const calls = vi.hoisted(() => ({ evaluate: 0, rate: 0, evaluateDelayMs: 0 }));
vi.mock("@/server/ai/tasks", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/ai/tasks")>();
  return {
    ...real,
    evaluatePerformance: async (...args: Parameters<typeof real.evaluatePerformance>) => {
      calls.evaluate++;
      if (calls.evaluateDelayMs) await new Promise((r) => setTimeout(r, calls.evaluateDelayMs));
      return real.evaluatePerformance(...args);
    },
    rateAnswer: async (...args: Parameters<typeof real.rateAnswer>) => {
      calls.rate++;
      return real.rateAnswer(...args);
    },
  };
});

const SCENARIO = {
  title: "[Test AI] Reducing employee turnover",
  studentRole: "Consultant",
  judgeRole: "Owner",
  situation: "A retailer lost 40% of its part-time staff last year.",
  task: "Recommend a retention plan.",
  indicators: ["Explain the costs of employee turnover"],
  judgeQuestions: ["How would you measure success?"],
  prepSec: 600,
  performSec: 600,
};
const RESPONSE = "Good afternoon. I recommend a mentoring program and flexible scheduling to cut turnover, which costs about six hundred dollars per new hire, and I will measure results monthly.";

async function signIn() {
  const u = await makeUser();
  const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, u.id));
  auth.user = { id: u.id, email: u.email, role: u.role, emailVerified: true, profile };
  return u;
}

async function judgeSession(userId: string, values: Partial<typeof schema.aiSessions.$inferInsert> = {}) {
  const [s] = await db
    .insert(schema.aiSessions)
    .values({ userId, kind: "judge", eventId: "deca-pbm", title: SCENARIO.title, scenario: SCENARIO, ...values })
    .returning();
  return s;
}

async function questionSet(userId: string, values: Partial<typeof schema.aiSessions.$inferInsert> = {}) {
  const questions = ["Why this plan?", "What does it cost?", "How will you measure it?"];
  const [s] = await db
    .insert(schema.aiSessions)
    .values({ userId, kind: "judge_questions", eventId: "deca-pbm", title: "PBM judge questions", scenario: { questions, answers: {} }, ...values })
    .returning();
  return s;
}

const sessionRow = async (id: string) => (await db.select().from(schema.aiSessions).where(eq(schema.aiSessions.id, id)))[0];
const feedbackRows = (sessionId: string) => db.select().from(schema.aiFeedback).where(eq(schema.aiFeedback.sessionId, sessionId));

beforeEach(() => {
  calls.evaluate = 0;
  calls.rate = 0;
  calls.evaluateDelayMs = 0;
  auth.user = null;
});

describe("judge question feedback limits", () => {
  it("gives one feedback per question and stores each answer", async () => {
    const u = await signIn();
    const s = await questionSet(u.id);
    const first = await answerJudgeQuestion(s.id, 0, "Because turnover is expensive.");
    expect(first).toMatchObject({ ok: true, data: { rating: 3 } });
    const again = await answerJudgeQuestion(s.id, 0, "A second try at the same question.");
    expect(again).toEqual({ ok: false, error: expect.stringMatching(/already had feedback/) });
    expect(await answerJudgeQuestion(s.id, 1, "About $600 per hire.")).toMatchObject({ ok: true });
    expect(calls.rate).toBe(2);
    const sc = (await sessionRow(s.id)).scenario as { answers: Record<string, { answer: string }>; claims?: Record<string, string> };
    expect(Object.keys(sc.answers).sort()).toEqual(["0", "1"]);
    expect(sc.answers["0"].answer).toBe("Because turnover is expensive.");
    expect(sc.claims ?? {}).toEqual({});
    // XP for the set is awarded once.
    const xp = await db.select().from(schema.xpEvents).where(and(eq(schema.xpEvents.userId, u.id), eq(schema.xpEvents.reason, "judge_questions")));
    expect(xp).toHaveLength(1);
  });

  it("makes concurrent answers to one question share a single model call", async () => {
    const u = await signIn();
    const s = await questionSet(u.id);
    const results = await Promise.all(Array.from({ length: 5 }, (_, i) => answerJudgeQuestion(s.id, 2, `Answer number ${i}`)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(calls.rate).toBe(1);
  });

  it("refuses sets older than a day, other students' sets, other session kinds and unknown questions", async () => {
    const u = await signIn();
    const old = await questionSet(u.id, { createdAt: new Date(Date.now() - 25 * 3600_000) });
    expect(await answerJudgeQuestion(old.id, 0, "Late answer")).toEqual({ ok: false, error: expect.stringMatching(/more than a day old/) });

    const judge = await judgeSession(u.id);
    expect(await answerJudgeQuestion(judge.id, 0, "Wrong kind")).toEqual({ ok: false, error: expect.stringMatching(/isn't a judge questions set/) });

    const mine = await questionSet(u.id);
    expect(await answerJudgeQuestion(mine.id, 3, "No such question")).toEqual({ ok: false, error: "Question not found." });
    expect(await answerJudgeQuestion(mine.id, -1, "No such question")).toEqual({ ok: false, error: "Question not found." });
    expect(await answerJudgeQuestion(mine.id, 0.5, "No such question")).toEqual({ ok: false, error: "Question not found." });
    expect(await answerJudgeQuestion(mine.id, 2 ** 40, "No such question")).toEqual({ ok: false, error: "Question not found." });

    await signIn();
    expect(await answerJudgeQuestion(mine.id, 0, "Someone else's set")).toMatchObject({ ok: false });
    expect(calls.rate).toBe(0);
    expect(((await sessionRow(mine.id)).scenario as { answers: object }).answers).toEqual({});
  });

  it("releases the question when the AI call fails so a retry works", async () => {
    const u = await signIn();
    const s = await questionSet(u.id);
    expect(await answerJudgeQuestion(s.id, 0, "fail-ai please")).toMatchObject({ ok: false });
    expect(((await sessionRow(s.id)).scenario as { claims?: Record<string, string> }).claims ?? {}).toEqual({});
    expect(await answerJudgeQuestion(s.id, 0, "A real answer this time.")).toMatchObject({ ok: true });
  });
});

describe("judge run scoring", () => {
  it("scores only judge rounds", async () => {
    const u = await signIn();
    const s = await questionSet(u.id);
    expect(await submitJudgeRun(s.id, { transcript: RESPONSE, durationSec: 120 })).toEqual({ ok: false, error: expect.stringMatching(/isn't a judge practice round/) });
    expect(calls.evaluate).toBe(0);
    expect(await feedbackRows(s.id)).toHaveLength(0);
    expect((await sessionRow(s.id)).status).toBe("open");
  });

  it("scores concurrent submits of one round exactly once", async () => {
    const u = await signIn();
    const s = await judgeSession(u.id, { kind: "face_to_face" });
    calls.evaluateDelayMs = 400;
    const results = await Promise.all([submitJudgeRun(s.id, { transcript: RESPONSE, durationSec: 300 }), submitJudgeRun(s.id, { transcript: RESPONSE, durationSec: 300 })]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({ ok: false, error: expect.stringMatching(/already being scored/) });
    expect(calls.evaluate).toBe(1);
    expect(await feedbackRows(s.id)).toHaveLength(1);
    expect((await sessionRow(s.id)).status).toBe("scored");
    // A later retry sees the finished round instead of scoring it again.
    expect(await submitJudgeRun(s.id, { transcript: RESPONSE, durationSec: 300 })).toEqual({ ok: true });
    expect(calls.evaluate).toBe(1);
  });

  it("puts the round back to open when the AI call fails, so the free retry works", async () => {
    const u = await signIn();
    const s = await judgeSession(u.id);
    expect(await submitJudgeRun(s.id, { transcript: "fail-ai please", durationSec: 60 })).toMatchObject({ ok: false });
    expect((await sessionRow(s.id)).status).toBe("open");
    expect(await feedbackRows(s.id)).toHaveLength(0);
    expect(await submitJudgeRun(s.id, { transcript: RESPONSE, durationSec: 300 })).toEqual({ ok: true });
    expect((await sessionRow(s.id)).status).toBe("scored");
    expect(await feedbackRows(s.id)).toHaveLength(1);
    expect(calls.evaluate).toBe(2);
  });

  it("waits out a live claim but takes over one abandoned by a crashed request", async () => {
    const u = await signIn();
    const live = await judgeSession(u.id, { status: "scoring" });
    expect(await submitJudgeRun(live.id, { transcript: RESPONSE, durationSec: 300 })).toEqual({ ok: false, error: expect.stringMatching(/already being scored/) });
    expect(calls.evaluate).toBe(0);

    const abandoned = await judgeSession(u.id, { status: "scoring", updatedAt: new Date(Date.now() - 30 * 60_000) });
    expect(await submitJudgeRun(abandoned.id, { transcript: RESPONSE, durationSec: 300 })).toEqual({ ok: true });
    expect((await sessionRow(abandoned.id)).status).toBe("scored");
  });

  it("refuses another student's round", async () => {
    const owner = await signIn();
    const s = await judgeSession(owner.id);
    await signIn();
    expect(await submitJudgeRun(s.id, { transcript: RESPONSE, durationSec: 300 })).toMatchObject({ ok: false });
    expect(calls.evaluate).toBe(0);
    expect((await sessionRow(s.id)).status).toBe("open");
  });
});
