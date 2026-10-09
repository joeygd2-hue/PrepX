import { handleStripeWebhook } from "@/server/billing";
import { features } from "@/lib/env";
import { errorDetail } from "@/lib/errors";

/** Stripe webhook. The raw body is required for signature verification. */
export async function POST(req: Request) {
  if (!features.billing()) return new Response("Billing not configured", { status: 404 });
  const body = await req.text();
  try {
    const r = await handleStripeWebhook(body, req.headers.get("stripe-signature"));
    return Response.json({ received: true, duplicate: r.duplicate });
  } catch (e) {
    console.error("stripe webhook rejected", errorDetail(e));
    return new Response("Invalid signature", { status: 400 });
  }
}
