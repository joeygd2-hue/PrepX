export const LEVELS = [
  { level: 1, name: "Rookie", minXp: 0, color: "ink" },
  { level: 2, name: "Competitor", minXp: 500, color: "competitor" },
  { level: 3, name: "Finalist", minXp: 1500, color: "finalist" },
  { level: 4, name: "Champion", minXp: 3500, color: "champion" },
  { level: 5, name: "Legend", minXp: 7000, color: "legend" },
] as const;

export const ACCENTS = [
  { id: "ink", label: "Ink", swatch: "#0a0a0a", unlockLevel: 1 },
  { id: "competitor", label: "Competitor", swatch: "#c9d4f6", unlockLevel: 2 },
  { id: "finalist", label: "Finalist", swatch: "#c7e4d3", unlockLevel: 3 },
  { id: "champion", label: "Champion", swatch: "#dccbf3", unlockLevel: 4 },
  { id: "legend", label: "Legend", swatch: "#ead9c5", unlockLevel: 5 },
] as const;

export function levelFor(xp: number) {
  let current: (typeof LEVELS)[number] = LEVELS[0];
  for (const l of LEVELS) if (xp >= l.minXp) current = l;
  const next = LEVELS.find((l) => l.minXp > xp) ?? null;
  return { ...current, next, toNext: next ? next.minXp - xp : 0, progress: next ? (xp - current.minXp) / (next.minXp - current.minXp) : 1 };
}

/** XP awarded per activity. Server-side only; clients never send amounts. */
export const XP = {
  questionCorrect: 5,
  questionAnswered: 1,
  lessonComplete: 40,
  unitMastered: 100,
  examSubmitted: 50,
  judgeRun: 60,
  coachSession: 10,
  planTask: 15,
  flashcardSession: 15,
  checkin: 10,
  referral: 100,
  explainBack: 15,
} as const;
