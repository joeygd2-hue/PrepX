import "server-only";
import { aiChat, type ChatTurn } from "./provider";
import { SAFETY } from "./tasks";

export const ASK_MODES = ["explain", "define", "example", "simpler", "question"] as const;
export type AskMode = (typeof ASK_MODES)[number];

/** What each quick action asks for. Built on the server so the client can't change the prompt. */
const REQUESTS: Record<Exclude<AskMode, "question">, string> = {
  explain: "Explain this clearly, step by step.",
  define: "Define this in one sentence, then give one concrete example.",
  example: "Give me one realistic example that shows this idea in action.",
  simpler: "Explain this more simply, like I'm new to the topic.",
};

export function askRequest(mode: AskMode, question: string | null) {
  return mode === "question" ? (question ?? "").trim() : REQUESTS[mode];
}

/**
 * Study helper for highlighted text: defines terms, explains passages and questions, and
 * answers follow-ups. Prompts carry only study text, never the student's identity.
 */
export async function askTutor(o: { selection: string; context: string; eventLine: string | null; turns: ChatTurn[] }) {
  const system = `TASK:ask
You are the study helper inside PrepX, a practice app for DECA, FBLA, HOSA and TSA competitors. A student highlighted something while studying, or typed a question, and wants help understanding it.
${o.eventLine ? `They're preparing for: ${o.eventLine}` : ""}
How to answer:
- Keep it under 150 words unless they ask for more. Plain text; "- " lists are fine; bold a key term with **double asterisks**. No headings, tables or links.
- Teach at a high-school level with one concrete example from business, health care or technology when it helps.
- If the highlighted text is a practice question, explain the concept and how to reason toward the answer. Don't just state which letter is correct unless they ask directly.
- If the answer depends on official competition rules, rubrics or point values, say that and point them to the official guidelines instead of guessing.
- If the highlighted text is unclear or not study material, say what you can and ask what they'd like to know.
${SAFETY}`;
  // Typed questions without a highlight go to the model as they are.
  const frame = o.selection
    ? `Highlighted text:\n"""${o.selection}"""${o.context && o.context !== o.selection ? `\n\nSurrounding text on the page:\n"""${o.context}"""` : ""}\n\n`
    : "";
  const [first, ...rest] = o.turns;
  const turns: ChatTurn[] = [{ role: "user", content: `${frame}${first.content}` }, ...rest];
  return aiChat(system, turns, { maxTokens: 900, effort: "low" });
}
