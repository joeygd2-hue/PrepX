import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { env } from "@/lib/env";
import { mockChat, mockStructured } from "./mock";

export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI practice isn't configured on this server yet.");
  }
}
export class AiFailedError extends Error {
  constructor(message = "The AI service didn't respond. You weren't charged for this attempt. Please try again.") {
    super(message);
  }
}

export type ChatTurn = { role: "user" | "assistant"; content: string };
export type ImageInput = { mediaType: "image/jpeg" | "image/png" | "image/webp"; base64: string };
type Opts = { maxTokens?: number; effort?: "low" | "medium" | "high"; images?: ImageInput[] };

let anthropic: Anthropic | null = null;
function client() {
  anthropic ??= new Anthropic({ timeout: env.ai.timeoutMs, maxRetries: 1 });
  return anthropic;
}

function guard() {
  if (env.ai.provider === "none") throw new AiNotConfiguredError();
  if (env.ai.provider === "mock" && env.isProd) throw new AiNotConfiguredError();
}

function toMessages(turns: ChatTurn[], images?: ImageInput[]): Anthropic.Beta.BetaMessageParam[] {
  return turns.map((t, i) => {
    if (t.role === "user" && images?.length && i === turns.length - 1) {
      return {
        role: "user",
        content: [
          ...images.map((img) => ({ type: "image" as const, source: { type: "base64" as const, media_type: img.mediaType, data: img.base64 } })),
          { type: "text" as const, text: t.content },
        ],
      };
    }
    return { role: t.role, content: t.content };
  });
}

/**
 * Server-side Claude call. `fallbacks: "default"` lets the API re-run a request on a
 * fallback model if a safety classifier declines it, instead of failing the student's attempt.
 */
const FALLBACK = { betas: ["server-side-fallback-2026-07-01"] as Anthropic.Beta.AnthropicBeta[], fallbacks: "default" as const };

export async function aiChat(system: string, turns: ChatTurn[], opts: Opts = {}): Promise<string> {
  guard();
  if (env.ai.provider === "mock") return mockChat(system, turns);
  try {
    const res = await client().beta.messages.create({
      model: env.ai.model,
      max_tokens: opts.maxTokens ?? 2000,
      system,
      messages: toMessages(turns, opts.images),
      output_config: { effort: opts.effort ?? "low" },
      ...FALLBACK,
    });
    if (res.stop_reason === "refusal") throw new AiFailedError("The AI couldn't help with that request. Try rephrasing it around your event.");
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
    if (!text) throw new AiFailedError();
    return text;
  } catch (e) {
    throw mapError(e);
  }
}

export async function aiStructured<T extends z.ZodType>(system: string, turns: ChatTurn[], schema: T, opts: Opts = {}): Promise<z.infer<T>> {
  guard();
  if (env.ai.provider === "mock") return schema.parse(mockStructured(system, turns));
  try {
    const res = await client().beta.messages.parse({
      model: env.ai.model,
      max_tokens: opts.maxTokens ?? 4000,
      system,
      messages: toMessages(turns, opts.images),
      output_config: { effort: opts.effort ?? "medium", format: betaZodOutputFormat(schema) },
      ...FALLBACK,
    });
    if (res.stop_reason === "refusal") throw new AiFailedError("The AI couldn't evaluate that response. Try again with your event content.");
    const parsed = (res as { parsed_output?: unknown }).parsed_output;
    if (!parsed) throw new AiFailedError();
    return schema.parse(parsed);
  } catch (e) {
    throw mapError(e);
  }
}

function mapError(e: unknown): Error {
  if (e instanceof AiFailedError || e instanceof AiNotConfiguredError) return e;
  if (e instanceof Anthropic.AuthenticationError) {
    console.error("AI auth error: check ANTHROPIC_API_KEY");
    return new AiNotConfiguredError();
  }
  if (e instanceof Anthropic.RateLimitError) return new AiFailedError("PrepX's AI service is busy right now. You weren't charged. Try again in a minute.");
  if (e instanceof Anthropic.APIError) {
    console.error(`AI API error ${e.status}`);
    return new AiFailedError();
  }
  console.error("AI call failed", (e as Error)?.message);
  return new AiFailedError();
}
