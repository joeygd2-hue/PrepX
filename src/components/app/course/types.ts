/** Data the lesson page hands the course reader. Markdown sources carry key-term tokens from `markTerms`. */
export type ReaderPage =
  | { kind: "intro" }
  | { kind: "lesson"; source: string; part: number; parts: number }
  | { kind: "practice"; source: string }
  | { kind: "terms" }
  | { kind: "check" }
  | { kind: "finish" };

export type CheckAnswer = { chosen: number | null; correct: boolean; answerIndex: number; explanation: string };
export type CheckQuestion = { id: string; stem: string; choices: string[]; answered: CheckAnswer | null };
export type TermDef = { term: string; definition: string };
