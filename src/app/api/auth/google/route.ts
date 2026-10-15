import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { generateCodeVerifier, generateState } from "arctic";
import { env } from "@/lib/env";
import { googleClient } from "@/server/auth/google";

export async function GET() {
  const google = googleClient();
  if (!google) return NextResponse.redirect(new URL("/sign-in?error=google", env.appUrl));
  const state = generateState();
  const verifier = generateCodeVerifier();
  const url = google.createAuthorizationURL(state, verifier, ["openid", "email", "profile"]);
  url.searchParams.set("prompt", "select_account");
  const jar = await cookies();
  const opts = { httpOnly: true, secure: env.isProd, sameSite: "lax" as const, maxAge: 600, path: "/" };
  jar.set("g_state", state, opts);
  jar.set("g_verifier", verifier, opts);
  return NextResponse.redirect(url);
}
