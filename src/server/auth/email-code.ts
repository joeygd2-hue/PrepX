import "server-only";
import { and, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { safeEqual, sha256, sixDigitCode } from "@/lib/crypto";
import { sendEmail } from "@/server/email";
import { rateLimit, RateLimitError } from "@/server/ratelimit";

const CODE_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;

export async function requestSignInCode(email: string, ip: string) {
  const normalized = email.trim().toLowerCase();
  if (!(await rateLimit(`code:email:${normalized}`, 5, 900)) || !(await rateLimit(`code:ip:${ip}`, 20, 900))) {
    throw new RateLimitError();
  }
  const code = sixDigitCode();
  await db.insert(schema.emailCodes).values({
    email: normalized,
    codeHash: sha256(`${normalized}:${code}`),
    purpose: "sign_in",
    expiresAt: new Date(Date.now() + CODE_TTL_MIN * 60_000),
  });
  await sendEmail({
    to: normalized,
    template: "sign_in_code",
    subject: `${code} is your PrepX sign-in code`,
    text: `Your PrepX sign-in code is ${code}.\n\nIt expires in ${CODE_TTL_MIN} minutes. If you didn't request it, you can ignore this email.`,
  });
}

/**
 * Returns true when the code matches; consumes it. Attempts are capped per code and per email.
 * Each guess is counted by one conditional UPDATE before the hash is compared, so parallel requests
 * can't get past the cap, and consuming only succeeds while the code is unused, so it signs in once.
 */
export async function verifySignInCode(email: string, code: string, ip: string) {
  const normalized = email.trim().toLowerCase();
  // The email limit doesn't depend on the client address, which an attacker can vary.
  if (!(await rateLimit(`verify:ip:${ip}`, 30, 900)) || !(await rateLimit(`verify:email:${normalized}`, 10, 3600))) {
    throw new RateLimitError();
  }
  const codes = schema.emailCodes;
  const live = () => and(isNull(codes.usedAt), gt(codes.expiresAt, new Date()));
  const [newest] = await db
    .select({ id: codes.id })
    .from(codes)
    .where(and(eq(codes.email, normalized), live()))
    .orderBy(desc(codes.createdAt))
    .limit(1);
  if (!newest) return false;
  const [counted] = await db
    .update(codes)
    .set({ attempts: sql`${codes.attempts} + 1` })
    .where(and(eq(codes.id, newest.id), lt(codes.attempts, MAX_ATTEMPTS), live()))
    .returning({ codeHash: codes.codeHash });
  if (!counted || !safeEqual(counted.codeHash, sha256(`${normalized}:${code.trim()}`))) return false;
  // Consuming also retires this email's older unused codes.
  const consumed = await db
    .update(codes)
    .set({ usedAt: new Date() })
    .where(and(eq(codes.email, normalized), isNull(codes.usedAt)))
    .returning({ id: codes.id });
  return consumed.some((r) => r.id === newest.id);
}
