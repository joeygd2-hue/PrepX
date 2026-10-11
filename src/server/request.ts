import "server-only";
import { headers } from "next/headers";
import { env } from "@/lib/env";

/**
 * The client address, for rate limits. A platform's own client-IP header wins when running on that
 * platform (or, for Cloudflare, when enabled). Otherwise each trusted proxy appends the address it
 * received the request from to X-Forwarded-For, so the client is the entry `trustedProxyCount` from
 * the right; anything further left is whatever the client sent and is ignored.
 */
export async function clientIp() {
  const h = await headers();
  const { proxy } = env;
  const platform =
    (proxy.cloudflare ? h.get("cf-connecting-ip")?.trim() : "") ||
    (proxy.vercel ? h.get("x-vercel-forwarded-for")?.trim() : "") ||
    (proxy.fly ? h.get("fly-client-ip")?.trim() : "");
  if (platform) return platform;
  const hops = (h.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const forwarded = proxy.trustedProxyCount > 0 ? hops[hops.length - proxy.trustedProxyCount] : undefined;
  return forwarded || h.get("x-real-ip")?.trim() || "unknown";
}

/** Same-origin check for JSON route handlers (server actions are checked by Next.js). */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (new URL(origin).host !== host) throw new Response("Forbidden", { status: 403 });
}
