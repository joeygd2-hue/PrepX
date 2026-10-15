import "server-only";
import { Google } from "arctic";
import { env, features } from "@/lib/env";

/** Google's name claims wait in this cookie for onboarding's name step instead of being saved before the age check. */
export const PREFILL_NAME_COOKIE = "prepx_prefill_name";

export function googleClient() {
  if (!features.google()) return null;
  return new Google(env.google.clientId, env.google.clientSecret, `${env.appUrl}/api/auth/google/callback`);
}

/** Decodes the ID token payload. The token came directly from Google's token endpoint over TLS. */
export function decodeIdToken(idToken: string): { sub: string; email?: string; email_verified?: boolean; given_name?: string; family_name?: string } {
  const payload = idToken.split(".")[1];
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

/** Value for PREFILL_NAME_COOKIE, or null when Google sent no name. */
export function prefillNameCookieValue(claims: { given_name?: string; family_name?: string }) {
  const clip = (s?: string) => (typeof s === "string" ? s.trim().slice(0, 50) : "");
  const first = clip(claims.given_name);
  const last = clip(claims.family_name);
  return first || last ? encodeURIComponent(JSON.stringify({ first, last })) : null;
}
