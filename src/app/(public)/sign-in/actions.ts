"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requestSignInCode, verifySignInCode } from "@/server/auth/email-code";
import { upsertVerifiedUser } from "@/server/auth/accounts";
import { createSession, destroySession } from "@/server/auth/session";
import { clientIp } from "@/server/request";
import { RateLimitError } from "@/server/ratelimit";
import { databaseHint, errorDetail } from "@/lib/errors";
import { env } from "@/lib/env";

const PENDING = "prepx_pending_email";
export type FormState = { error?: string; ok?: boolean } | undefined;

export async function requestCodeAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z.string().trim().email().max(254).safeParse(form.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address." };
  try {
    await requestSignInCode(parsed.data, await clientIp());
  } catch (e) {
    if (e instanceof RateLimitError) return { error: e.message };
    const hint = databaseHint(e);
    console.error(`sign-in code send failed: ${errorDetail(e)}${hint ? `\n  Hint: ${hint}` : ""}`);
    // In development, show the actual cause so setup problems are obvious.
    if (!env.isProd && hint) return { error: `Setup problem: ${hint}` };
    return { error: "We couldn't send the code right now. Please try again in a minute." };
  }
  (await cookies()).set(PENDING, parsed.data.toLowerCase(), { httpOnly: true, sameSite: "lax", maxAge: 900, path: "/" });
  redirect("/sign-in/email?step=code");
}

export async function verifyCodeAction(_: FormState, form: FormData): Promise<FormState> {
  const jar = await cookies();
  const email = jar.get(PENDING)?.value;
  if (!email) return { error: "Your code expired. Start again." };
  const code = String(form.get("code") ?? "").replace(/\D/g, "");
  if (code.length !== 6) return { error: "Enter the 6-digit code from your email." };
  let ok = false;
  try {
    ok = await verifySignInCode(email, code, await clientIp());
  } catch (e) {
    if (e instanceof RateLimitError) return { error: e.message };
    throw e;
  }
  if (!ok) return { error: "That code isn't right or has expired. Check your email or request a new one." };
  jar.delete(PENDING);
  const { id, isNew } = await upsertVerifiedUser(email);
  if (isNew) await applyReferral(id);
  await createSession(id);
  redirect(isNew ? "/welcome" : "/");
}

export async function applyReferral(userId: string) {
  const jar = await cookies();
  const ref = jar.get("prepx_ref")?.value;
  if (!ref) return;
  const [referrer] = await db.select({ userId: schema.profiles.userId }).from(schema.profiles).where(sql`${schema.profiles.referralCode} = ${ref.toUpperCase()}`);
  if (referrer && referrer.userId !== userId) await db.update(schema.profiles).set({ referredBy: referrer.userId }).where(eq(schema.profiles.userId, userId));
  jar.delete("prepx_ref");
}

export async function signOutAction() {
  await destroySession();
  redirect("/sign-in");
}
