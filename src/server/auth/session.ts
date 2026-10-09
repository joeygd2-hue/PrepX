import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { env } from "@/lib/env";
import { randomToken, sha256 } from "@/lib/crypto";

export const SESSION_COOKIE = "prepx_session";
const SESSION_DAYS = 30;

export async function createSession(userId: string) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  const ua = (await headers()).get("user-agent")?.slice(0, 200) ?? null;
  await db.insert(schema.sessions).values({ id: sha256(token), userId, expiresAt, userAgent: ua });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  // Opportunistic cleanup of expired sessions for this user.
  await db.delete(schema.sessions).where(and(eq(schema.sessions.userId, userId), lt(schema.sessions.expiresAt, new Date())));
}

export type CurrentUser = {
  id: string;
  email: string;
  role: "student" | "staff" | "admin";
  emailVerified: boolean;
  profile: typeof schema.profiles.$inferSelect | null;
};

/** Resolves the signed-in user once per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({ user: schema.users, profile: schema.profiles, expiresAt: schema.sessions.expiresAt, sid: schema.sessions.id })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
    .where(and(eq(schema.sessions.id, sha256(token)), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.user.id,
    email: row.user.email,
    role: row.user.role,
    emailVerified: Boolean(row.user.emailVerifiedAt),
    profile: row.profile,
  };
});

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.id, sha256(token)));
  jar.delete(SESSION_COOKIE);
}

/** For pages and actions that need a signed-in, onboarded user. */
export async function requireUser(opts: { allowIncompleteOnboarding?: boolean } = {}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!opts.allowIncompleteOnboarding && !user.profile?.onboardingCompletedAt) redirect("/welcome");
  return user;
}

export async function requireRole(roles: ("staff" | "admin")[]) {
  const user = await requireUser();
  if (!roles.includes(user.role as "staff" | "admin")) redirect("/");
  return user;
}

/** Throwing variant for route handlers / actions that must not redirect. */
export async function userOrThrow() {
  const user = await getCurrentUser();
  if (!user || !user.profile?.onboardingCompletedAt) throw new Response("Unauthorized", { status: 401 });
  return user;
}
