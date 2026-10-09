import "server-only";
import { Google } from "arctic";
import { env, features } from "@/lib/env";

export function googleClient() {
  if (!features.google()) return null;
  return new Google(env.google.clientId, env.google.clientSecret, `${env.appUrl}/api/auth/google/callback`);
}

/** Decodes the ID token payload. The token came directly from Google's token endpoint over TLS. */
export function decodeIdToken(idToken: string): { sub: string; email?: string; email_verified?: boolean; given_name?: string; family_name?: string } {
  const payload = idToken.split(".")[1];
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}
