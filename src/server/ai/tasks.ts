import "server-only";
import { z } from "zod";
import type { schema } from "@/db";
import { aiChat, aiStructured, type ChatTurn, type ImageInput } from "./provider";

type EventRow = typeof schema.events.$inferSelect;

const SAFETY = `You are working with high school students (ages 13-18). Keep everything age-appropriate and focused on competition preparation. Never ask for personal information. If a student mentions being in danger, self-harm or abuse, respond with care, encourage them to talk to a trusted adult, and share that in the U.S. they can call or text 988. Do not claim to be an official judge or to know official scores.`;

export function describeEvent(e: EventRow) {
  const c = e.components;
  const parts = [`${e.name} (${e.org.toUpperCase()} ${e.code}), category: ${e.category}, format: ${e.formatLabel}.`];
  if (c.exam) parts.push(`Exam: ${c.exam.label}${c.exam.questions ? `, ${c.exam.questions} questions` : ""}${c.exam.minutes ? `, ${c.exam.minutes} minutes` : ""}.`);
  if (c.roleplay) parts.push(`Role-play: ${c.roleplay.prepMinutes ?? "?"} min prep, ${c.roleplay.performMinutes ?? "?"} min with the judge${c.roleplay.indicators ? `, ${c.roleplay.indicators} performance indicators` : ""}.`);
  if (c.caseStudy) parts.push(`Case study: ${c.caseStudy.prepMinutes ?? "?"} min prep, ${c.caseStudy.performMinutes ?? "?"} min presentation, team event.`);
  if (c.presentation) parts.push(`Presentation: ${c.presentation.label}.`);
  if (c.written) parts.push(`Written component: ${c.written.label}.`);
  if (c.interview) parts.push("Includes an interview.");
  if (e.verification !== "verified") parts.push("Note: these format details have not been verified against the current official guidelines; tell the student to confirm specifics in the official guidelines when it matters.");
  return parts.join(" ");
}

/* ───────── Coach ───────── */

export async function coachReply(event: EventRow | null, history: ChatTurn[]) {
  const system = `TASK:coach\nYou are PrepX Coach, a supportive, knowledgeable competition coach for DECA, FBLA, HOSA and TSA.
${event ? `The student is preparing for: ${describeEvent(event)}` : "The student hasn't chosen an event yet; help them explore."}
How to coach:
- Explain concepts clearly with a short example. Prefer a question back to the student over handing them a finished answer, so they learn.
- When they share an answer, say specifically why it is strong or weak and how to improve it.
- Be concise (under 200 words unless asked for more). Use plain text with short lists when helpful.
- Never invent official rules, point values or rubric weights. If unsure about an official requirement, say so and point them to the official guidelines.
${SAFETY}`;
  return aiChat(system, history.slice(-20), { maxTokens: 1200, effort: "low" });
}

/* ───────── Role-play / case scenario ───────── */

export const ScenarioSchema = z.object({
  title: z.string(),
  studentRole: z.string(),
  judgeRole: z.string(),
  situation: z.string(),
  task: z.string(),
  indicators: z.array(z.string()).min(1).max(6),
  judgeQuestions: z.array(z.string()).min(1).max(3),
});
export type Scenario = z.infer<typeof ScenarioSchema>;

export async function generateScenario(event: EventRow) {
  const c = event.components;
  const count = c.roleplay?.indicators ?? (c.caseStudy ? 4 : 3);
  const system = `TASK:scenario\nYou write realistic, original practice scenarios for high school competitive events. ${SAFETY}`;
  const prompt = `Write one original practice scenario for: ${describeEvent(event)}
- The student plays a business/health/technology professional; the judge plays a client, manager or stakeholder.
- Include exactly ${count} performance indicators written as short skills ("Explain the nature of business risk").
- Include 2 follow-up questions a judge might ask at the end.
- Situation: 120-180 words, specific company and numbers, solvable in the time allowed. Do not copy official materials.`;
  return aiStructured(system, [{ role: "user", content: prompt }], ScenarioSchema, { maxTokens: 3000, effort: "low" });
}

/* ───────── Judge evaluation ───────── */

export const EvaluationSchema = z.object({
  criteria: z.array(z.object({ id: z.string(), rating: z.number().int().min(1).max(5), comment: z.string() })),
  summary: z.string(),
  strengths: z.array(z.string()).max(4),
  nextSteps: z.array(z.string()).min(1).max(4),
});
export type Evaluation = z.infer<typeof EvaluationSchema>;

export type RubricItem = { id: string; label: string; description: string };

export async function evaluatePerformance(opts: {
  event: EventRow;
  rubric: RubricItem[];
  rubricBasis: "verified" | "general";
  context: string; // scenario or task description
  response: string; // transcript or text
  durationSec?: number;
  timeLimitSec?: number;
  images?: ImageInput[];
}) {
  const criteria = opts.rubric.map((r) => `- id "${r.id}": ${r.label} — ${r.description}`).join("\n");
  const system = `TASK:evaluate\nYou are a fair, encouraging practice judge for high school competitive events. You give simulated practice feedback only; you are not an official judge and must not present scores as official.
Rate ONLY the criteria listed, each from 1 (not demonstrated) to 5 (exceptional), with one or two specific sentences quoting or referring to what the student actually said. Do not add criteria or weights.
${opts.rubricBasis === "general" ? "These criteria are general practice criteria, not the official rubric." : ""}
Be honest: a short or off-topic response must receive low ratings. Next steps must be concrete actions the student can practice.
${SAFETY}`;
  const timing = opts.durationSec ? `\nThe student spoke/worked for ${Math.round(opts.durationSec)} seconds${opts.timeLimitSec ? ` of ${opts.timeLimitSec} allowed` : ""}.` : "";
  const images = opts.images?.length ? `\n${opts.images.length} still frame(s) from the student's camera are attached. Comment on posture, eye contact and presence under the "presence" criterion only.` : "";
  const content = `Event: ${describeEvent(opts.event)}\n\nTask given to the student:\n${opts.context}\n\nCriteria:\n${criteria}${timing}${images}\n\nStudent response (transcript or text):\n"""${opts.response.slice(0, 20000)}"""`;
  const out = await aiStructured(system, [{ role: "user", content }], EvaluationSchema, { maxTokens: 4000, effort: "medium", images: opts.images });
  // Keep only known criteria, in rubric order; missing ones count as 1.
  const byId = new Map(out.criteria.map((c) => [c.id, c]));
  const merged = opts.rubric.map((r) => {
    const c = byId.get(r.id);
    return { id: r.id, label: r.label, rating: c?.rating ?? 1, comment: c?.comment ?? "Not addressed in this response." };
  });
  const avg = merged.reduce((a, c) => a + c.rating, 0) / Math.max(merged.length, 1);
  return { criteria: merged, score: Math.round(((avg - 1) / 4) * 100), summary: out.summary, strengths: out.strengths, nextSteps: out.nextSteps };
}

/* ───────── Judge follow-up questions ───────── */

export const QuestionListSchema = z.object({ questions: z.array(z.string()).min(5).max(20) });

export async function likelyQuestions(event: EventRow) {
  const system = `TASK:judge_questions\nYou help high school students prepare for judge questions. ${SAFETY}`;
  return aiStructured(
    system,
    [{ role: "user", content: `List 20 likely, varied follow-up questions a judge could ask a student competing in: ${describeEvent(event)}. Mix concept checks, "why" questions and scenario twists. Return them as plain questions.` }],
    QuestionListSchema,
    { maxTokens: 3000, effort: "low" },
  );
}

export const AnswerFeedbackSchema = z.object({ rating: z.number().int().min(1).max(5), feedback: z.string(), strongerAnswer: z.string() });

export async function rateAnswer(event: EventRow, question: string, answer: string) {
  const system = `TASK:rate_answer\nYou give short, specific practice feedback on a student's spoken answer to a judge question. Rate 1-5. Suggest a stronger answer outline (not a script to memorize). ${SAFETY}`;
  return aiStructured(system, [{ role: "user", content: `Event: ${describeEvent(event)}\nQuestion: ${question}\nStudent answer: """${answer.slice(0, 4000)}"""` }], AnswerFeedbackSchema, {
    maxTokens: 1500,
    effort: "low",
  });
}

/* ───────── Explain it back ───────── */

export const ExplainSchema = z.object({ verdict: z.enum(["got_it", "close", "not_yet"]), feedback: z.string() });

export async function checkExplanation(term: string, definition: string, explanation: string) {
  const system = `TASK:explain\nYou check whether a high school student understands a term from how they explain it in their own words. Accept paraphrases and examples; do not require the textbook wording. Feedback: 1-3 sentences, encouraging and specific. ${SAFETY}`;
  return aiStructured(system, [{ role: "user", content: `Term: ${term}\nReference definition: ${definition}\nStudent explanation: """${explanation.slice(0, 2000)}"""` }], ExplainSchema, {
    maxTokens: 800,
    effort: "low",
  });
}

/* ───────── Practice question generation (admin/staff) ───────── */

export const GeneratedQuestionsSchema = z.object({
  questions: z.array(z.object({ stem: z.string(), choices: z.array(z.string()).length(4), answerIndex: z.number().int().min(0).max(3), explanation: z.string() })).min(1).max(15),
});

export async function generateQuestions(topic: string, unitTitle: string, count: number) {
  const system = `TASK:generate_questions\nYou write ORIGINAL multiple-choice practice questions for high school competitive-event exams. Never reproduce questions from official or copyrighted exams. Each question has exactly 4 plausible choices, one correct answer and a one-sentence explanation. Vary the position of the correct answer.`;
  return aiStructured(system, [{ role: "user", content: `Write ${count} questions for the exam "${topic}", topic area "${unitTitle}".` }], GeneratedQuestionsSchema, { maxTokens: 6000, effort: "medium" });
}
