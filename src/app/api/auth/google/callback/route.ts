import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { env } from "@/lib/env";
import { decodeIdToken, googleClient } from "@/server/auth/google";
import { upsertVerifiedUser } from "@/server/auth/accounts";
import { createSession } from "@/server/auth/session";
import { applyReferral } from "@/app/(public)/sign-in/actions";
import { rateLimit } from "@/server/ratelimit";

export async function GET(req: NextRequest) {
  const fail = (code = "google") => NextResponse.redirect(new URL(`/sign-in?error=${code}`, env.appUrl));
  const google = googleClient();
  if (!google) return fail();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (!(await rateLimit(`google:${ip}`, 30, 900))) return fail();

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const jar = await cookies();
  const savedState = jar.get("g_state")?.value;
  const verifier = jar.get("g_verifier")?.value;
  jar.delete("g_state");
  jar.delete("g_verifier");
  if (!code || !state || !savedState || !verifier || state !== savedState) return fail();

  try {
    const tokens = await google.validateAuthorizationCode(code, verifier);
    const claims = decodeIdToken(tokens.idToken());
    if (!claims.email || !claims.email_verified) return fail("google_unverified");
    const { id, isNew } = await upsertVerifiedUser(claims.email, claims.sub);
    if (isNew) {
      await applyReferral(id);
      await db
        .update(schema.profiles)
        .set({ firstName: claims.given_name?.slice(0, 50) ?? "", lastName: claims.family_name?.slice(0, 50) ?? "" })
        .where(eq(schema.profiles.userId, id));
    }
    await createSession(id);
    return NextResponse.redirect(new URL(isNew ? "/welcome" : "/", env.appUrl));
  } catch (e) {
    console.error("google oauth failed", (e as Error).message);
    return fail();
  }
}
