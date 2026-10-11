import type { EventComponents } from "@/db/schema";

/** The study bank behind an event: its official test topic, or the knowledge bank for events without a test. */
export function studyBankFor(c: EventComponents): { id: string; official: boolean; label: string } | null {
  if (c.exam) return { id: c.exam.clusterId, official: true, label: c.exam.label };
  if (c.knowledge) return { id: c.knowledge.clusterId, official: false, label: c.knowledge.label };
  return null;
}

/** "How to compete" banks for each part of an event, in the order a student meets them. */
const SKILLS: [keyof EventComponents, string][] = [
  ["roleplay", "skills-roleplay"],
  ["caseStudy", "skills-case-study"],
  ["presentation", "skills-presentation"],
  ["written", "skills-written"],
  ["interview", "skills-interview"],
  ["production", "skills-project"],
  ["exam", "skills-test"],
  ["spelldown", "skills-test"],
];

export function skillBanksFor(c: EventComponents): string[] {
  const ids = SKILLS.filter(([k]) => Boolean(c[k])).map(([, id]) => id);
  return [...new Set(ids)];
}
