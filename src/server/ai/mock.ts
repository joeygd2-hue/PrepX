/**
 * Deterministic stand-in for the AI provider. Enabled only with AI_PROVIDER=mock and
 * refused in production. The UI labels every mock response so it is never mistaken for
 * real feedback. Used by automated tests and offline development.
 */
import type { ChatTurn } from "./provider";

const task = (system: string) => /^TASK:(\w+)/.exec(system)?.[1] ?? "chat";

export function mockChat(system: string, turns: ChatTurn[]) {
  const last = turns.at(-1)?.content ?? "";
  if (/fail-ai/i.test(last)) throw new Error("mock failure");
  return `[Test AI] Good question. Here's a practice tip about "${last.slice(0, 60)}": start with the key concept, give one example, then connect it to the judge's goal.`;
}

export function mockStructured(system: string, turns: ChatTurn[]): unknown {
  const last = turns.at(-1)?.content ?? "";
  if (/fail-ai/i.test(last)) throw new Error("mock failure");
  switch (task(system)) {
    case "scenario":
      return {
        title: "[Test AI] Reducing employee turnover at Lakeside Outfitters",
        studentRole: "Human resources consultant",
        judgeRole: "Owner of Lakeside Outfitters",
        situation: "Lakeside Outfitters, a 3-store outdoor retailer, lost 40% of its part-time staff last year. Training each new hire costs about $600. The owner wants a plan to keep employees longer before the busy summer season.",
        task: "Recommend a retention plan and explain how it will pay for itself.",
        indicators: ["Explain the nature of human resources management", "Describe employee motivation techniques", "Explain the costs of employee turnover", "Recommend a course of action"],
        judgeQuestions: ["How would you measure whether the plan worked?", "What would you do first with a small budget?"],
      };
    case "evaluate": {
      const ids = [...last.matchAll(/- id "([^"]+)"/g)].map((m) => m[1]);
      const short = (last.split('"""')[1] ?? "").trim().split(/\s+/).length < 20;
      return {
        criteria: ids.map((id, i) => ({ id, rating: short ? 1 : 3 + (i % 2), comment: short ? "[Test AI] The response was too short to show this skill." : "[Test AI] You addressed this with a relevant example." })),
        summary: short ? "[Test AI] Your response was too brief to evaluate fully." : "[Test AI] A solid, organized response with room for more specific numbers.",
        strengths: short ? [] : ["Clear opening", "Connected ideas to the scenario"],
        nextSteps: ["Open with a one-sentence recommendation", "Support each point with a number from the scenario"],
      };
    }
    case "judge_questions":
      return { questions: Array.from({ length: 20 }, (_, i) => `[Test AI] Practice judge question ${i + 1}: why does your recommendation fit this business?`) };
    case "rate_answer":
      return { rating: 3, feedback: "[Test AI] Clear answer; add a specific example.", strongerAnswer: "State your point, give one example, then tie it back to the goal." };
    case "explain":
      return { verdict: last.split('"""')[1]?.trim().split(/\s+/).length > 6 ? "got_it" : "not_yet", feedback: "[Test AI] Check whether your explanation includes the key idea and an example." };
    case "generate_questions":
      return {
        questions: [{ stem: "[Test AI] Which is an example of a fixed cost?", choices: ["Monthly rent", "Packaging", "Raw materials", "Sales commission"], answerIndex: 0, explanation: "Rent stays the same regardless of output." }],
      };
    default:
      return {};
  }
}
