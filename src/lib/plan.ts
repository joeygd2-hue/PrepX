/**
 * Smart study plan: milestones counted back from the competition date, adapted to the
 * event's format and condensed when there isn't enough time for the full schedule.
 * Pure functions so they can be unit-tested and reused on server and client.
 */
import type { EventComponents } from "@/db/schema";

export type PlanStats = {
  lessonsCompleted: number;
  totalLessons: number;
  questionsAnswered: number;
  last100Accuracy: number | null; // 0..1
  last100Count: number;
  fullExams: number;
  judgeRuns: number;
  judgeScoresRecent: number[]; // newest first, 0..100
  rehearsalsLast7Days: number;
  activeDaysLast14: number;
  presentationChecks: number;
  entryChecks: number;
  coachSessions: number;
  readiness: number;
};

export type EventShape = { hasExam: boolean; hasBank: boolean; judged: boolean; written: boolean; presentation: boolean };

export function eventShape(c: EventComponents, hasBank: boolean): EventShape {
  return {
    hasExam: Boolean(c.exam),
    hasBank,
    judged: Boolean(c.roleplay || c.caseStudy || c.presentation || c.interview),
    written: Boolean(c.written),
    presentation: Boolean(c.presentation),
  };
}

export type Criterion = { id: string; label: string; current: number; target: number; met: boolean };
export type Milestone = {
  key: string;
  offsetDays: number; // days before competition
  heading: string; // "6 weeks out · Learn the material"
  dueInDays: number;
  criteria: Criterion[];
  done: boolean;
};

const STANDARD = [
  { key: "learn", offset: 42, label: "6 weeks out", title: "Learn the material" },
  { key: "pressure", offset: 28, label: "4 weeks out", title: "Practice under pressure" },
  { key: "sharpen", offset: 14, label: "2 weeks out", title: "Sharpen up" },
  { key: "game", offset: 7, label: "1 week out", title: "Game week" },
] as const;

const FULL_PLAN_DAYS = 49;

function c(id: string, label: string, current: number, target: number): Criterion {
  return { id, label, current, target, met: current >= target };
}

function criteriaFor(key: string, shape: EventShape, s: PlanStats, scale: number): Criterion[] {
  const n = (x: number) => Math.max(1, Math.round(x * scale));
  const examish = shape.hasExam && shape.hasBank;
  const out: Criterion[] = [];
  switch (key) {
    case "learn":
      if (examish) {
        out.push(c("lessons", `Finish ${Math.min(n(4), s.totalLessons || n(4))} lessons`, s.lessonsCompleted, Math.min(n(4), s.totalLessons || n(4))));
        out.push(c("questions", `Answer ${n(50)} practice questions`, s.questionsAnswered, n(50)));
      } else {
        out.push(c("coach", `Review your event requirements with the AI coach ${n(2)} times`, s.coachSessions, n(2)));
        if (shape.written) out.push(c("entry", "Run 1 written entry check", s.entryChecks, 1));
        else if (shape.judged) out.push(c("judge", "Do 1 AI judge run", s.judgeRuns, 1));
      }
      break;
    case "pressure":
      if (examish) out.push(c("exams", `Take ${n(2)} full practice exams`, s.fullExams, n(2)));
      if (shape.presentation && !shape.hasExam) out.push(c("pres", "Run 1 presentation check", s.presentationChecks, 1));
      if (shape.judged) out.push(c("judge1", "Do 1 AI judge run", s.judgeRuns, 1));
      if (!out.length) out.push(c("questions2", `Answer ${n(150)} practice questions`, s.questionsAnswered, n(150)));
      break;
    case "sharpen":
      if (examish)
        out.push({
          id: "acc",
          label: `70% on your last ${n(100)} questions`,
          current: s.last100Count >= n(100) ? Math.round((s.last100Accuracy ?? 0) * 100) : 0,
          target: 70,
          met: s.last100Count >= n(100) && (s.last100Accuracy ?? 0) >= 0.7,
        });
      if (shape.judged) out.push(c("judge3", `${n(3)} AI judge runs total`, s.judgeRuns, n(3)));
      if (shape.written) out.push(c("entry2", "2 written entry checks total", s.entryChecks, 2));
      break;
    case "game":
      if (examish) out.push(c("rehearsal", "Test-day rehearsal this week", s.rehearsalsLast7Days, 1));
      out.push(c("readiness", "Readiness 80 or higher", s.readiness, 80));
      break;
  }
  return out;
}

export type Plan = {
  mode: "full" | "condensed" | "past" | "no-date";
  daysLeft: number | null;
  milestones: Milestone[];
  status: "On track" | "Ahead" | "Behind" | "Competition day" | "Season wrapped";
};

export function buildPlan(daysLeft: number | null, shape: EventShape, stats: PlanStats): Plan {
  if (daysLeft === null) {
    // No date: show the standard milestones as an estimate anchored 8 weeks out.
    return { ...buildPlan(56, shape, stats), mode: "no-date", daysLeft: null };
  }
  if (daysLeft < 0) return { mode: "past", daysLeft, milestones: [], status: "Season wrapped" };
  if (daysLeft === 0) return { mode: "past", daysLeft, milestones: [], status: "Competition day" };

  const condensed = daysLeft < FULL_PLAN_DAYS;
  const scale = condensed ? Math.max(0.25, daysLeft / FULL_PLAN_DAYS) : 1;
  const used = new Set<number>();
  const milestones: Milestone[] = STANDARD.map((m, i) => {
    let offset = condensed ? Math.round(m.offset * scale) : m.offset;
    // Keep offsets strictly decreasing and before the competition.
    while (used.has(offset) && offset > 0) offset--;
    offset = Math.min(offset, daysLeft);
    used.add(offset);
    const criteria = criteriaFor(m.key, shape, stats, condensed ? Math.max(scale, 0.4) : 1);
    const heading = condensed ? `Phase ${i + 1} · ${m.title}` : `${m.label} · ${m.title}`;
    return { key: m.key, offsetDays: offset, heading, dueInDays: daysLeft - offset, criteria, done: criteria.every((x) => x.met) };
  });

  const overdue = milestones.some((m) => m.dueInDays < 0 && !m.done);
  const next = milestones.find((m) => m.dueInDays >= 0 && !m.done);
  const ahead = !overdue && milestones.some((m) => m.done && m.dueInDays > 3);
  return {
    mode: condensed ? "condensed" : "full",
    daysLeft,
    milestones,
    status: overdue ? "Behind" : ahead && (!next || next.dueInDays > 0) ? "Ahead" : "On track",
  };
}

/* ───────────── Readiness ───────────── */

export type ReadinessPart = { id: string; label: string; weight: number; value: number };

export function readiness(shape: EventShape, s: Omit<PlanStats, "readiness">): { score: number; parts: ReadinessPart[]; label: string } {
  const consistency = Math.min(1, s.activeDaysLast14 / 10) * 100;
  const parts: ReadinessPart[] = [];
  if (shape.judged) {
    const last3 = [...s.judgeScoresRecent.slice(0, 3)];
    while (last3.length < 3) last3.push(0);
    parts.push({ id: "judged", label: "Judged practice", weight: 0.75, value: last3.reduce((a, b) => a + b, 0) / 3 });
  } else {
    const volume = Math.min(1, s.last100Count / 100);
    parts.push({ id: "accuracy", label: "Test accuracy", weight: 0.75, value: (s.last100Accuracy ?? 0) * volume * 100 });
  }
  parts.push({ id: "consistency", label: "Consistency", weight: 0.25, value: consistency });
  const score = Math.round(parts.reduce((a, p) => a + p.weight * p.value, 0));
  const label = score >= 80 ? "Competition ready" : score >= 50 ? "Getting there" : score >= 20 ? "Building" : "Just starting";
  return { score, parts, label };
}

/* ───────────── Daily tasks ───────────── */

export type TaskSpec = { kind: string; title: string; minutes: number; description: string; href: string };

export function dailyTasks(opts: {
  eventCode: string;
  eventName: string;
  examLabel?: string;
  examClusterId?: string;
  shape: EventShape;
  daysLeft: number | null;
  minutesPerDay: number;
  nextUnit?: { id: string; title: string } | null;
  mistakesOpen: number;
  weakestCriterion?: string | null;
  dayIndex: number; // rotates variety
  competitionName?: string | null;
}): { headline: string; tasks: TaskSpec[] } {
  const { shape, eventCode, examClusterId } = opts;
  const examQ = examClusterId ? `?exam=${encodeURIComponent(examClusterId)}` : "";
  const tasks: TaskSpec[] = [];
  const gameWeek = opts.daysLeft !== null && opts.daysLeft <= 7;
  const examish = shape.hasExam && shape.hasBank;

  if (examish) {
    if (gameWeek && opts.dayIndex % 2 === 0)
      tasks.push({ kind: "rehearsal", title: "Test-Day Rehearsal", minutes: 20, description: "Exam conditions with no pausing and auto-submit, so competition day feels familiar.", href: `/study/practice${examQ}&mode=rehearsal` });
    else if (opts.nextUnit && opts.dayIndex % 3 !== 2)
      tasks.push({ kind: "lesson", title: `Lesson: ${opts.nextUnit.title}`, minutes: 5, description: `A 5-minute lesson with 3 check questions. ${opts.examLabel ?? "Your exam"} draws on this area, so it's worth locking in early.`, href: `/study/learn/${opts.nextUnit.id}` });
    else
      tasks.push({ kind: "quick10", title: "Core Exam Concepts Quick Review", minutes: 5, description: `${eventCode} draws on ${opts.examLabel ?? "your exam"}; 10 quick questions will find gaps before they cost you points.`, href: `/study/practice${examQ}&mode=quick10` });
  }
  if (shape.judged) {
    if (shape.written && !shape.hasExam && opts.dayIndex % 2 === 1)
      tasks.push({ kind: "entry", title: "Written Entry Check", minutes: 10, description: "Get structured feedback on your written entry against the event requirements.", href: "/study/check?type=entry" });
    else
      tasks.push({ kind: "judge", title: "AI Judge Practice Run", minutes: 12, description: `Simulate a ${eventCode} judge round so you get comfortable with the scenario, delivery, timing and judge questions.`, href: "/study/judge" });
    tasks.push({ kind: "coach", title: "Debrief with Coach", minutes: 3, description: "Ask the AI coach what your biggest weak point was so you know exactly what to drill next session.", href: "/study/coach?prompt=debrief" });
  }
  if (examish && tasks.length < 3) {
    if (opts.mistakesOpen > 0)
      tasks.push({ kind: "mistakes", title: "Mistake Notebook", minutes: 5, description: `${opts.mistakesOpen} missed question${opts.mistakesOpen === 1 ? "" : "s"} waiting. Get each one right twice to clear it.`, href: `/study/practice${examQ}&mode=mistakes` });
    else
      tasks.push({ kind: "flashcards", title: "Flashcard Review", minutes: 5, description: "Key terms come up again and again on the exam. A quick review keeps them fresh.", href: `/study/flashcards${examQ}` });
  }
  if (!examish && !shape.judged) {
    tasks.push({ kind: "coach", title: "Requirements Walkthrough", minutes: 8, description: `Ask the AI coach to walk you through what ${opts.eventName} judges look for.`, href: "/study/coach" });
  }
  if (opts.minutesPerDay >= 30 && examish) tasks.push({ kind: "sprint", title: "60-Second Sprint", minutes: 2, description: "As many as you can in a minute. Beat your best.", href: `/study/practice${examQ}&mode=sprint` });
  const max = opts.minutesPerDay <= 10 ? 2 : opts.minutesPerDay <= 20 ? 3 : 4;

  const d = opts.daysLeft;
  const phase = d === null ? "build your foundation" : d > 42 ? `master ${eventCode} fundamentals` : d > 14 ? "practice under pressure" : d > 7 ? "sharpen up" : "stay sharp for game week";
  const headline = d === null ? `Set your competition date, then ${phase} today!` : d === 0 ? "It's competition day. You've got this!" : `${d} day${d === 1 ? "" : "s"} to ${opts.competitionName ?? "go"}—${phase} today!`;
  return { headline, tasks: tasks.slice(0, max) };
}
