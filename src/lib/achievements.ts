export type AchievementStats = {
  longestStreak: number;
  questionsAnswered: number;
  lessonsCompleted: number;
  judgeRuns: number;
  examsSubmitted: number;
  planComplete: boolean;
  referralsActive: number;
};

export const ACHIEVEMENTS: { id: string; label: string; description: string; group: "streak" | "practice"; test: (s: AchievementStats) => boolean }[] = [
  { id: "warming-up", label: "Warming up", description: "Study 3 days in a row", group: "streak", test: (s) => s.longestStreak >= 3 },
  { id: "one-week-streak", label: "One-week streak", description: "Study 7 days in a row", group: "streak", test: (s) => s.longestStreak >= 7 },
  { id: "month-of-focus", label: "Month of focus", description: "Study 30 days in a row", group: "streak", test: (s) => s.longestStreak >= 30 },
  { id: "unstoppable", label: "Unstoppable", description: "Study 100 days in a row", group: "streak", test: (s) => s.longestStreak >= 100 },
  { id: "first-steps", label: "First steps", description: "Answer your first practice question", group: "practice", test: (s) => s.questionsAnswered >= 1 },
  { id: "century", label: "Century", description: "Answer 100 practice questions", group: "practice", test: (s) => s.questionsAnswered >= 100 },
  { id: "lesson-learner", label: "Lesson learner", description: "Complete 5 lessons", group: "practice", test: (s) => s.lessonsCompleted >= 5 },
  { id: "judge-ready", label: "Judge ready", description: "Finish an AI judge run", group: "practice", test: (s) => s.judgeRuns >= 1 },
  { id: "full-dress", label: "Full dress rehearsal", description: "Submit a full practice exam", group: "practice", test: (s) => s.examsSubmitted >= 1 },
  { id: "plan-finisher", label: "Plan finisher", description: "Complete every study-plan milestone", group: "practice", test: (s) => s.planComplete },
  { id: "recruiter", label: "Recruiter", description: "A friend you invited starts practicing", group: "practice", test: (s) => s.referralsActive >= 1 },
];

export function earnedAchievements(s: AchievementStats) {
  return ACHIEVEMENTS.filter((a) => a.test(s)).map((a) => a.id);
}
