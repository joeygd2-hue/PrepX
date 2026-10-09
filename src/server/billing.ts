import "server-only";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { env, features } from "@/lib/env";
import { seasonKey, todayIn } from "@/lib/dates";

let client: Stripe | null = null;
export function stripe() {
  if (!features.billing()) return null;
  client ??= new Stripe(env.stripe.secretKey);
  return client;
}

/** Season boosts last until the end of the current competition season (Jul 31). */
function seasonEnd() {
  const start = Number(seasonKey(todayIn("UTC")).slice(0, 4));
  return new Date(Date.UTC(start + 1, 7, 1));
}

export async function createCheckout(userId: string, email: string, kind: "pro" | "season_boost") {
  const s = stripe();
  if (!s) throw new Error("Billing is not configured");
  const price = kind === "pro" ? env.stripe.priceProMonthly : env.stripe.priceSeasonBoost;
  if (!price) throw new Error("This plan is not available");
  const [existing] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId));
  const session = await s.checkout.sessions.create({
    mode: kind === "pro" ? "subscription" : "payment",
    line_items: [{ price, quantity: 1 }],
    client_reference_id: userId,
    customer: existing?.customerId ?? undefined,
    customer_email: existing?.customerId ? undefined : email,
    metadata: { userId, kind },
    subscription_data: kind === "pro" ? { metadata: { userId } } : undefined,
    success_url: `${env.appUrl}/profile/plan?checkout=returned`,
    cancel_url: `${env.appUrl}/profile/plan?checkout=cancelled`,
  });
  return session.url!;
}

export async function createPortal(userId: string) {
  const s = stripe();
  const [sub] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId));
  if (!s || !sub?.customerId) return null;
  const portal = await s.billingPortal.sessions.create({ customer: sub.customerId, return_url: `${env.appUrl}/profile/plan` });
  return portal.url;
}

function periodEnd(sub: Stripe.Subscription): Date | null {
  const item = sub.items?.data?.[0] as (Stripe.SubscriptionItem & { current_period_end?: number }) | undefined;
  const ts = item?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end;
  return ts ? new Date(ts * 1000) : null;
}

async function upsertFromSubscription(sub: Stripe.Subscription) {
  const userId = sub.metadata?.userId;
  if (!userId) return;
  const [u] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, userId));
  if (!u) return;
  const row = {
    userId,
    provider: "stripe",
    customerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    subscriptionId: sub.id,
    kind: "subscription",
    status: sub.status,
    currentPeriodEnd: periodEnd(sub),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    updatedAt: new Date(),
  };
  await db.insert(schema.subscriptions).values(row).onConflictDoUpdate({ target: schema.subscriptions.userId, set: row });
}

/** Verifies the signature, ignores duplicates, and applies the event. */
export async function handleStripeWebhook(rawBody: string, signature: string | null) {
  const s = stripe();
  if (!s || !signature) throw new Error("Billing not configured or missing signature");
  const event = s.webhooks.constructEvent(rawBody, signature, env.stripe.webhookSecret);
  const inserted = await db.insert(schema.billingEvents).values({ id: event.id, type: event.type }).onConflictDoNothing().returning();
  if (!inserted.length) return { duplicate: true };

  switch (event.type) {
    case "checkout.session.completed": {
      const cs = event.data.object as Stripe.Checkout.Session;
      const userId = cs.metadata?.userId;
      if (userId && cs.metadata?.kind === "season_boost" && cs.payment_status === "paid") {
        const row = {
          userId,
          provider: "stripe",
          customerId: typeof cs.customer === "string" ? cs.customer : null,
          subscriptionId: null,
          kind: "season_boost",
          status: "active",
          currentPeriodEnd: seasonEnd(),
          cancelAtPeriodEnd: true,
          updatedAt: new Date(),
        };
        await db.insert(schema.subscriptions).values(row).onConflictDoUpdate({ target: schema.subscriptions.userId, set: row });
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await upsertFromSubscription(event.data.object as Stripe.Subscription);
      break;
  }
  if (inserted[0]) {
    const userId = (event.data.object as { metadata?: { userId?: string } }).metadata?.userId;
    if (userId) await db.update(schema.billingEvents).set({ userId }).where(eq(schema.billingEvents.id, event.id)).catch(() => undefined);
  }
  return { duplicate: false };
}

export async function cancelStripeSubscription(userId: string) {
  const s = stripe();
  const [sub] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId));
  if (!s || !sub?.subscriptionId || sub.status === "canceled") return;
  await s.subscriptions.cancel(sub.subscriptionId);
}
