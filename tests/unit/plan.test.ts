import { describe, expect, it } from "vitest";
import { buildPlan, dailyTasks, eventShape, readiness, type PlanStats } from "@/lib/plan";

const empty: PlanStats = {
  lessonsCompleted: 0,
  totalLessons: 13,
  questionsAnswered: 0,
  last100Accuracy: null,
  last100Count: 0,
  fullExams: 0,
  judgeRuns: 0,
  judgeScoresRecent: [],
  rehearsalsLast7Days: 0,
  activeDaysLast14: 0,
  presentationChecks: 0,
  entryChecks: 0,
  coachSessions: 0,
  readiness: 0,
};
const pbm = eventShape({ exam: { clusterId: "deca-bac", label: "BAC" }, roleplay: { prepMinutes: 10, performMinutes: 10, indicators: 4 } }, true);

describe("smart study plan", () => {
  it("reproduces the reference milestones 190 days out", () => {
    const plan = buildPlan(190, pbm, empty);
    expect(plan.mode).toBe("full");
    expect(plan.status).toBe("On track");
    expect(plan.milestones.map((m) => m.heading)).toEqual([
      "6 weeks out · Learn the material",
      "4 weeks out · Practice under pressure",
      "2 weeks out · Sharpen up",
      "1 week out · Game week",
    ]);
    expect(plan.milestones.map((m) => m.dueInDays)).toEqual([148, 162, 176, 183]);
    expect(plan.milestones[0].criteria.map((c) => c.label)).toEqual(["Finish 4 lessons", "Answer 50 practice questions"]);
    expect(plan.milestones[1].criteria.map((c) => c.label)).toEqual(["Take 2 full practice exams", "Do 1 AI judge run"]);
    expect(plan.milestones[2].criteria.map((c) => c.label)).toEqual(["70% on your last 100 questions", "3 AI judge runs total"]);
    expect(plan.milestones[3].criteria.map((c) => c.label)).toEqual(["Test-day rehearsal this week", "Readiness 80 or higher"]);
  });

  it("marks milestones done from real stats", () => {
    const plan = buildPlan(190, pbm, { ...empty, lessonsCompleted: 4, questionsAnswered: 60 });
    expect(plan.milestones[0].done).toBe(true);
    expect(plan.milestones[1].done).toBe(false);
  });

  it("reports Behind when a student who started early misses a milestone", () => {
    // Started 190 days out, now 20 days out with nothing done.
    const plan = buildPlan(20, pbm, empty, 190);
    expect(plan.mode).toBe("full");
    expect(plan.status).toBe("Behind");
    expect(plan.milestones[0].dueInDays).toBe(-22);
  });

  it("condenses the plan when the date is close, with ordered due dates before competition", () => {
    const plan = buildPlan(21, pbm, empty);
    expect(plan.mode).toBe("condensed");
    expect(plan.milestones[0].heading).toMatch(/^Phase 1/);
    const due = plan.milestones.map((m) => m.dueInDays);
    expect([...due].sort((a, b) => a - b)).toEqual(due);
    due.forEach((d) => expect(d).toBeGreaterThanOrEqual(0));
    due.forEach((d) => expect(d).toBeLessThanOrEqual(21));
  });

  it("handles competition day, past dates and no date", () => {
    expect(buildPlan(0, pbm, empty).status).toBe("Competition day");
    expect(buildPlan(-3, pbm, empty).status).toBe("Season wrapped");
    expect(buildPlan(null, pbm, empty).mode).toBe("no-date");
  });

  it("adapts criteria to presentation-only events (no exam)", () => {
    const pres = eventShape({ written: { label: "Plan" }, presentation: { label: "Pitch" } }, false);
    const plan = buildPlan(100, pres, empty);
    const labels = plan.milestones.flatMap((m) => m.criteria.map((c) => c.label)).join(" | ");
    expect(labels).not.toMatch(/practice exam|lessons|questions/);
    expect(labels).toMatch(/written entry check/);
  });
});

describe("readiness", () => {
  it("weights judged practice 75% and consistency 25% for role-play events", () => {
    const r = readiness(pbm, { ...empty, judgeScoresRecent: [80, 80, 80], activeDaysLast14: 10 });
    expect(r.parts.map((p) => [p.label, p.weight])).toEqual([["Judged practice", 0.75], ["Consistency", 0.25]]);
    expect(r.score).toBe(85);
    expect(r.label).toBe("Competition ready");
  });

  it("starts at 0 / Just starting", () => {
    expect(readiness(pbm, empty)).toMatchObject({ score: 0, label: "Just starting" });
  });

  it("uses test accuracy (scaled by volume) for exam-only events", () => {
    const examOnly = eventShape({ exam: { clusterId: "hosa-mt", label: "MT" } }, true);
    const r = readiness(examOnly, { ...empty, last100Accuracy: 0.8, last100Count: 50 });
    expect(r.parts[0].label).toBe("Test accuracy");
    expect(Math.round(r.parts[0].value)).toBe(40);
  });
});

describe("daily tasks", () => {
  it("builds the reference trio for a role-play event with an exam", () => {
    const t = dailyTasks({ eventCode: "PBM", eventName: "PBM", shape: pbm, daysLeft: 190, minutesPerDay: 20, examClusterId: "deca-bac", mistakesOpen: 0, dayIndex: 2, competitionName: "DECA Internationals" });
    expect(t.headline).toBe("190 days to DECA Internationals—master PBM fundamentals today!");
    expect(t.tasks.map((x) => x.kind)).toEqual(["quick10", "judge", "coach"]);
    expect(t.tasks.reduce((a, x) => a + x.minutes, 0)).toBe(20);
  });

  it("respects a shorter daily study time", () => {
    const t = dailyTasks({ eventCode: "PBM", eventName: "PBM", shape: pbm, daysLeft: 50, minutesPerDay: 10, examClusterId: "deca-bac", mistakesOpen: 0, dayIndex: 2 });
    expect(t.tasks).toHaveLength(2);
  });
});
