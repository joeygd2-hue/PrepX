"use server";
import { z } from "zod";
import { userOrThrow } from "@/server/auth/session";
import { activeSelection } from "@/server/progress";
import { getAllowance, LimitReachedError } from "@/server/entitlements";
import { withUsage } from "@/server/ai/run";
import { AiFailedError, AiNotConfiguredError, type ChatTurn } from "@/server/ai/provider";
import { ASK_MODES, askRequest, askTutor } from "@/server/ai/ask";
import { describeEvent } from "@/server/ai/tasks";
import { rateLimit } from "@/server/ratelimit";
import { features } from "@/lib/env";
import { errorDetail } from "@/lib/errors";

export type AskResult = { ok: true; answer: string; remaining: number | null; mock: boolean } | { ok: false; error: string; limit?: boolean };

const AskInput = z.object({
  selection: z.string().trim().max(1200),
  context: z.string().trim().max(2000).default(""),
  mode: z.enum(ASK_MODES),
  question: z.string().trim().max(1000).nullable().default(null),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2500) }))
    .max(12)
    .default([]),
});

/** Explains highlighted study text or answers a typed question. Charged to the "ask_ai" allowance; failures are refunded. */
export async function askAi(input: z.input<typeof AskInput>): Promise<AskResult> {
  const user = await userOrThrow();
  const p = AskInput.safeParse(input);
  if (!p.success) return { ok: false, error: "That selection is too long. Highlight a shorter passage (up to about 200 words)." };
  const { selection, context, mode, question, history } = p.data;
  const request = askRequest(mode, question);
  if (!request) return { ok: false, error: "Type a question first." };
  if (!selection && mode !== "question") return { ok: false, error: "Highlight some text, or type a question." };
  if (history.length && history[0].role !== "user") return { ok: false, error: "Something went wrong. Please start a new question." };
  const tz = user.profile!.timezone;
  try {
    if (!(await rateLimit(`ask:${user.id}`, 20, 60))) return { ok: false, error: "You're asking very quickly. Wait a moment and try again." };
    const sel = await activeSelection(user.id, user.profile!.focusOrg);
    const turns: ChatTurn[] = [...history, { role: "user", content: request }];
    const answer = await withUsage(user.id, "ask_ai", tz, () =>
      askTutor({ selection: selection || "(nothing highlighted; answer the question below)", context, eventLine: sel ? describeEvent(sel.event) : null, turns }),
    );
    const left = await getAllowance(user.id, "ask_ai", tz);
    return { ok: true, answer, remaining: left.unlimited ? null : left.remaining, mock: features.aiIsMock() };
  } catch (e) {
    if (e instanceof LimitReachedError) return { ok: false, error: `You've used today's Ask AI explanations on your plan. ${e.resetsLabel}.`, limit: true };
    if (e instanceof AiNotConfiguredError) return { ok: false, error: "AI help isn't configured on this server yet." };
    if (e instanceof AiFailedError) return { ok: false, error: e.message };
    console.error("ask ai failed", errorDetail(e));
    return { ok: false, error: "The AI didn't respond. You weren't charged. Please try again." };
  }
}
