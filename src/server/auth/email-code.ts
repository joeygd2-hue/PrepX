import "server-only";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
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

/** Returns true when the code matches; consumes it. Attempts are capped per code. */
export async function verifySignInCode(email: string, code: string, ip: string) {
  const normalized = email.trim().toLowerCase();
  if (!(await rateLimit(`verify:ip:${ip}`, 30, 900))) throw new RateLimitError();
  const [row] = await db
    .select()
    .from(schema.emailCodes)
    .where(and(eq(schema.emailCodes.email, normalized), isNull(schema.emailCodes.usedAt), gt(schema.emailCodes.expiresAt, new Date())))
    .orderBy(desc(schema.emailCodes.createdAt))
    .limit(1);
  if (!row || row.attempts >= MAX_ATTEMPTS) return false;
  const ok = safeEqual(row.codeHash, sha256(`${normalized}:${code.trim()}`));
  await db
    .update(schema.emailCodes)
    .set(ok ? { usedAt: new Date() } : { attempts: row.attempts + 1 })
    .where(eq(schema.emailCodes.id, row.id));
  return ok;
}
