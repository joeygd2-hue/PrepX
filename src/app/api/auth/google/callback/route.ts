import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { decodeIdToken, googleClient, PREFILL_NAME_COOKIE, prefillNameCookieValue } from "@/server/auth/google";
import { upsertVerifiedUser } from "@/server/auth/accounts";
import { createSession } from "@/server/auth/session";
import { applyReferral } from "@/app/(public)/sign-in/actions";
import { rateLimit } from "@/server/ratelimit";
import { clientIp } from "@/server/request";
import { errorDetail } from "@/lib/errors";

export async function GET(req: NextRequest) {
  const fail = (code = "google") => NextResponse.redirect(new URL(`/sign-in?error=${code}`, env.appUrl));
  const google = googleClient();
  if (!google) return fail();
  if (!(await rateLimit(`google:${await clientIp()}`, 30, 900))) return fail();

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
      // Names only prefill the form: the profile gets them once the student passes the age check.
      const prefill = prefillNameCookieValue(claims);
      if (prefill) jar.set(PREFILL_NAME_COOKIE, prefill, { httpOnly: true, secure: env.isProd, sameSite: "lax", maxAge: 3600, path: "/" });
    }
    await createSession(id);
    return NextResponse.redirect(new URL(isNew ? "/welcome" : "/", env.appUrl));
  } catch (e) {
    console.error("google oauth failed", errorDetail(e));
    return fail();
  }
}
