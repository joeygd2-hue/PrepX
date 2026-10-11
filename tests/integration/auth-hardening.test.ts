import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { upsertVerifiedUser } from "@/server/auth/accounts";
import { requestSignInCode, verifySignInCode } from "@/server/auth/email-code";
import { prefillNameCookieValue } from "@/server/auth/google";
import { RateLimitError } from "@/server/ratelimit";

const request = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/headers")>()),
  headers: async () => request.headers,
}));

let n = 0;
const uniqueEmail = (tag: string) => `${tag}${Date.now()}_${++n}@prepx.test`;

async function issueCode(email: string, ip: string) {
  await requestSignInCode(email, ip);
  const [log] = await db.select().from(schema.emailLog).where(eq(schema.emailLog.to, email));
  return /code is (\d{6})/.exec(log.body!)![1];
}

describe("sign-in code verification", () => {
  it("counts parallel guesses atomically, so a burst gets at most 5 tries at a code", async () => {
    const email = uniqueEmail("burst");
    const code = await issueCode(email, "198.18.1.1");
    const guesses = Array.from({ length: 20 }, (_, i) => String((Number(code) + i + 1) % 1_000_000).padStart(6, "0"));
    // A different address per request, as an attacker rotating IPs would use.
    const results = await Promise.allSettled(guesses.map((g, i) => verifySignInCode(email, g, `198.18.1.${i + 10}`)));
    for (const r of results) {
      if (r.status === "fulfilled") expect(r.value).toBe(false);
      else expect(r.reason).toBeInstanceOf(RateLimitError);
    }
    const [row] = await db.select().from(schema.emailCodes).where(eq(schema.emailCodes.email, email));
    expect(row.attempts).toBe(5);
    // Lift the per-email limit so the next call reaches the code itself: it's exhausted.
    await db.delete(schema.rateLimits).where(eq(schema.rateLimits.key, `verify:email:${email}`));
    expect(await verifySignInCode(email, code, "198.18.1.99")).toBe(false);
  });

  it("signs in only once when the right code arrives several times at once", async () => {
    const email = uniqueEmail("race");
    const code = await issueCode(email, "198.18.2.1");
    const results = await Promise.all(Array.from({ length: 5 }, (_, i) => verifySignInCode(email, code, `198.18.2.${i + 10}`)));
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("retires the email's older codes once one is used", async () => {
    const email = uniqueEmail("older");
    const first = await issueCode(email, "198.18.4.1");
    await requestSignInCode(email, "198.18.4.1");
    const logs = await db.select().from(schema.emailLog).where(eq(schema.emailLog.to, email));
    const second = logs.map((l) => /code is (\d{6})/.exec(l.body!)![1]).find((c) => c !== first) ?? first;
    expect(await verifySignInCode(email, second, "198.18.4.2")).toBe(true);
    expect(await verifySignInCode(email, first, "198.18.4.3")).toBe(false);
  });

  it("limits verification per email whatever the client address", async () => {
    const email = uniqueEmail("spread");
    const code = await issueCode(email, "198.18.3.1");
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 10; i++) expect(await verifySignInCode(email, wrong, `198.18.3.${i + 10}`)).toBe(false);
    await expect(verifySignInCode(email, code, "198.18.3.99")).rejects.toThrow(/Too many/);
    // Another email is still allowed from the same client addresses.
    expect(await verifySignInCode(uniqueEmail("other"), wrong, "198.18.3.10")).toBe(false);
  });
});

describe("client IP", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  /** Loads clientIp with fresh config so the stubbed environment applies. */
  async function ipFor(vars: Record<string, string>, h: Record<string, string>) {
    for (const k of ["TRUSTED_PROXY_COUNT", "VERCEL", "FLY_APP_NAME", "TRUST_CF_CONNECTING_IP"]) vi.stubEnv(k, vars[k] ?? "");
    vi.resetModules();
    const { clientIp } = await import("@/server/request");
    request.headers = new Headers(h);
    return clientIp();
  }

  const platformSpoofs = { "x-vercel-forwarded-for": "6.6.6.1", "fly-client-ip": "6.6.6.2", "cf-connecting-ip": "6.6.6.3" };

  it("ignores client-supplied X-Forwarded-For entries and platform headers off-platform", async () => {
    expect(await ipFor({}, { "x-forwarded-for": "6.6.6.6, 203.0.113.7", ...platformSpoofs })).toBe("203.0.113.7");
    expect(await ipFor({ TRUSTED_PROXY_COUNT: "1" }, { "x-forwarded-for": "6.6.6.6,6.6.6.7 , 203.0.113.7" })).toBe("203.0.113.7");
    expect(await ipFor({}, { "x-forwarded-for": "203.0.113.7" })).toBe("203.0.113.7");
    expect(await ipFor({}, {})).toBe("unknown");
  });

  it("honors TRUSTED_PROXY_COUNT", async () => {
    const chain = { "x-forwarded-for": "6.6.6.6, 203.0.113.7, 10.0.0.2", "x-real-ip": "10.0.0.2" };
    expect(await ipFor({ TRUSTED_PROXY_COUNT: "2" }, chain)).toBe("203.0.113.7");
    expect(await ipFor({ TRUSTED_PROXY_COUNT: "4" }, chain)).toBe("10.0.0.2");
    expect(await ipFor({ TRUSTED_PROXY_COUNT: "0" }, { "x-forwarded-for": "6.6.6.6", "x-real-ip": "203.0.113.8" })).toBe("203.0.113.8");
    for (const bad of ["", "two", "-1", "1.5"]) {
      expect(await ipFor({ TRUSTED_PROXY_COUNT: bad }, chain)).toBe("10.0.0.2");
    }
  });

  it("prefers the platform's own header on that platform", async () => {
    const h = { "x-forwarded-for": "6.6.6.6, 10.0.0.2", ...platformSpoofs };
    expect(await ipFor({ VERCEL: "1" }, { ...h, "x-vercel-forwarded-for": "203.0.113.9" })).toBe("203.0.113.9");
    expect(await ipFor({ FLY_APP_NAME: "prepx" }, { ...h, "fly-client-ip": "203.0.113.10" })).toBe("203.0.113.10");
    expect(await ipFor({ TRUST_CF_CONNECTING_IP: "true", VERCEL: "1" }, { ...h, "cf-connecting-ip": "203.0.113.11" })).toBe("203.0.113.11");
    // On the platform but without its header, X-Forwarded-For still applies.
    expect(await ipFor({ VERCEL: "1" }, { "x-forwarded-for": "6.6.6.6, 203.0.113.12" })).toBe("203.0.113.12");
  });
});

describe("Google sign-in", () => {
  it("creates the account without saving any name before the age check", async () => {
    const { id, isNew } = await upsertVerifiedUser(uniqueEmail("google"), "google-sub-hardening");
    expect(isNew).toBe(true);
    const [p] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, id));
    expect([p.firstName, p.lastName, p.displayName]).toEqual(["", "", ""]);
  });

  it("passes Google's names to onboarding as a trimmed, capped cookie value", () => {
    const value = prefillNameCookieValue({ given_name: "  Ada ", family_name: "L".repeat(80) });
    expect(JSON.parse(decodeURIComponent(value!))).toEqual({ first: "Ada", last: "L".repeat(50) });
    expect(prefillNameCookieValue({ family_name: "Lovelace" })).toBe(encodeURIComponent(JSON.stringify({ first: "", last: "Lovelace" })));
    expect(prefillNameCookieValue({ given_name: "  " })).toBeNull();
  });
});
