import "server-only";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { env, features } from "@/lib/env";
import { seasonKey, todayIn } from "@/lib/dates";
import { errorDetail } from "@/lib/errors";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

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

/** Subscription statuses after which Stripe never bills again. Any other status is still open. */
const ENDED = ["canceled", "incomplete_expired"];

/** The customer's subscriptions that haven't ended, read from Stripe (the local row can be stale). */
async function openSubscriptionIds(s: Stripe, customerId: string) {
  const ids: string[] = [];
  for await (const sub of s.subscriptions.list({ customer: customerId, limit: 100 })) if (!ENDED.includes(sub.status)) ids.push(sub.id);
  return ids;
}

/** Checkouts refused for a reason the user can act on; the plan page explains `?checkout=<code>`. */
export const CHECKOUT_REFUSALS = {
  subscription_open: "You still have a monthly Pro subscription. Use Manage or cancel subscription to update your payment method or cancel it before buying a season boost.",
} as const;

export class CheckoutRefusedError extends Error {
  constructor(readonly code: keyof typeof CHECKOUT_REFUSALS) {
    super(CHECKOUT_REFUSALS[code]);
  }
}

export async function createCheckout(userId: string, email: string, kind: "pro" | "season_boost") {
  const s = stripe();
  if (!s) throw new Error("Billing is not configured");
  const price = kind === "pro" ? env.stripe.priceProMonthly : env.stripe.priceSeasonBoost;
  if (!price) throw new Error("This plan is not available");
  const [existing] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId));
  // Both share the user's one subscriptions row, so a boost must not stand in for a subscription that can still bill.
  if (kind === "season_boost" && existing) {
    const open = existing.kind === "subscription" && !ENDED.includes(existing.status);
    if (open || (existing.customerId && (await openSubscriptionIds(s, existing.customerId)).length)) throw new CheckoutRefusedError("subscription_open");
  }
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The account an event is for (the userId we put in its metadata), if that account still exists. */
async function eventUserId(tx: Tx, userId: string | undefined) {
  if (!userId || !UUID.test(userId)) return null;
  const [u] = await tx.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, userId));
  return u?.id ?? null;
}

async function upsertFromSubscription(tx: Tx, userId: string, sub: Stripe.Subscription) {
  const [current] = await tx.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId)).for("update");
  // A late event for an ended subscription must not overwrite a row now tracking another subscription or a season boost.
  if (current && current.subscriptionId !== sub.id && ENDED.includes(sub.status)) return;
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
  await tx.insert(schema.subscriptions).values(row).onConflictDoUpdate({ target: schema.subscriptions.userId, set: row });
}

async function applySeasonBoost(tx: Tx, userId: string, cs: Stripe.Checkout.Session) {
  if (cs.metadata?.kind !== "season_boost" || cs.payment_status !== "paid") return;
  const [current] = await tx.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId)).for("update");
  if (current?.kind === "subscription" && !ENDED.includes(current.status)) {
    // Checkout refuses this, so a subscription started while the boost checkout was open. Keep
    // tracking the subscription (it bills) and flag the boost payment for staff to refund.
    await tx.insert(schema.errorLog).values({ scope: "billing", message: `Season boost ${cs.id} was paid while subscription ${current.subscriptionId} is open; refund the boost.` });
    return;
  }
  const row = {
    userId,
    provider: "stripe",
    // Keep the known customer so open subscriptions can still be found and cancelled later.
    customerId: typeof cs.customer === "string" ? cs.customer : (current?.customerId ?? null),
    subscriptionId: null,
    kind: "season_boost",
    status: "active",
    currentPeriodEnd: seasonEnd(),
    cancelAtPeriodEnd: true,
    updatedAt: new Date(),
  };
  await tx.insert(schema.subscriptions).values(row).onConflictDoUpdate({ target: schema.subscriptions.userId, set: row });
}

/** The webhook signature or configuration is wrong: answer 400, since a retry can't succeed. */
export class WebhookRejectedError extends Error {}

function verifiedEvent(s: Stripe, rawBody: string, signature: string) {
  try {
    return s.webhooks.constructEvent(rawBody, signature, env.stripe.webhookSecret);
  } catch (e) {
    throw new WebhookRejectedError(errorDetail(e));
  }
}

/**
 * Verifies the signature, ignores duplicates, and applies the event. The event id is recorded in
 * the same transaction as its changes, so if applying fails nothing is recorded and Stripe's
 * retry applies it. Throws WebhookRejectedError for a bad request; any other error means "retry".
 */
export async function handleStripeWebhook(rawBody: string, signature: string | null) {
  const s = stripe();
  if (!s || !signature) throw new WebhookRejectedError("Billing not configured or missing signature");
  const event = verifiedEvent(s, rawBody, signature);
  return db.transaction(async (tx) => {
    const userId = await eventUserId(tx, (event.data.object as { metadata?: Stripe.Metadata | null }).metadata?.userId);
    const inserted = await tx.insert(schema.billingEvents).values({ id: event.id, type: event.type, userId }).onConflictDoNothing().returning({ id: schema.billingEvents.id });
    if (!inserted.length) return { duplicate: true };
    switch (event.type) {
      case "checkout.session.completed":
        if (userId) await applySeasonBoost(tx, userId, event.data.object);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        if (userId) await upsertFromSubscription(tx, userId, event.data.object);
        break;
    }
    return { duplicate: false };
  });
}

/** Cancelling failed, so the caller must stop (account deletion then deletes nothing). */
export class SubscriptionCancelError extends Error {}

/**
 * Cancels every subscription of the user's Stripe customer that hasn't ended, not only the one
 * stored locally (that row can be stale). Throws SubscriptionCancelError if it can't.
 */
export async function cancelStripeSubscriptions(userId: string) {
  const [sub] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId));
  if (!sub) return;
  const stored = sub.kind === "subscription" && sub.subscriptionId && !ENDED.includes(sub.status) ? sub.subscriptionId : null;
  const s = stripe();
  if (!s) {
    if (stored) throw new SubscriptionCancelError("Billing is not configured, so the open subscription can't be cancelled");
    return;
  }
  try {
    const ids = sub.customerId ? await openSubscriptionIds(s, sub.customerId) : stored ? [stored] : [];
    for (const id of ids) await s.subscriptions.cancel(id);
  } catch (e) {
    throw new SubscriptionCancelError(errorDetail(e), { cause: e });
  }
}
