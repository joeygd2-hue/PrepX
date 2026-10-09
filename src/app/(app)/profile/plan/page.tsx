import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { getAllowance, getPlanStatus, type Feature } from "@/server/entitlements";
import { features } from "@/lib/env";
import { BackHeader, Page } from "@/components/ui/page";
import { Notice } from "@/components/ui/form";
import { SectionLabel } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Your plan" };
const FEATURES: Feature[] = ["coach_message", "judge_run", "judge_questions", "explain_back", "full_exam", "entry_check", "presentation_check"];

export default async function Plan({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const user = await requireUser();
  const { checkout } = await searchParams;
  const tz = user.profile!.timezone;
  const plan = await getPlanStatus(user.id);
  const [sub] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, user.id));
  const limits = await db.select().from(schema.planLimits);
  const allowances = await Promise.all(FEATURES.map((f) => getAllowance(user.id, f, tz, plan)));
  const fmt = (n: number) => (n < 0 ? "Unlimited" : String(n));
  const per = (p: string) => (p === "day" ? "/day" : p === "season" ? "/season" : p === "month" ? "/month" : "");
  return (
    <Page>
      <BackHeader href="/profile" title="Your plan" />
      {checkout === "returned" ? (
        <Notice className="mb-4">
          {plan.isPro ? "Payment confirmed. Pro is active." : "We're confirming your payment with our payment provider. This page will show Pro once it's confirmed (usually within a minute). Refresh to check."}
        </Notice>
      ) : null}
      {checkout === "cancelled" ? <Notice className="mb-4">Checkout cancelled. You weren&apos;t charged.</Notice> : null}
      <section className="rounded-3xl bg-fg p-6 text-bg">
        <p className="eyebrow !text-bg/70">Current plan</p>
        <p className="mt-2 text-3xl font-semibold">{plan.isPro ? "Pro" : "Free"}</p>
        <p className="mt-1 opacity-80">
          {plan.source === "chapter"
            ? `Covered by ${plan.detail}. Your chapter pays for Pro for its members.`
            : plan.source === "season_boost"
              ? `Season boost · active until ${sub?.currentPeriodEnd?.toLocaleDateString() ?? "the end of the season"}. Does not renew.`
              : plan.source === "subscription"
                ? `${sub?.cancelAtPeriodEnd ? "Ends" : "Renews"} ${sub?.currentPeriodEnd?.toLocaleDateString() ?? ""}`
                : "Practice tests (within limits), lessons, flashcards and daily AI practice."}
        </p>
      </section>

      <SectionLabel>Your allowances</SectionLabel>
      <ul className="divide-y divide-border rounded-3xl border border-border px-5">
        {allowances.map((a) => (
          <li key={a.feature} className="flex items-center justify-between gap-3 py-3">
            <span>
              <span className="block font-medium">{a.label}</span>
              <span className="text-sm text-muted">{a.unlimited ? "Unlimited" : `${a.used} of ${a.limit} used · ${a.resets}`}</span>
            </span>
            <Chip>{a.unlimited ? "∞" : `${a.remaining} left`}</Chip>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">If an AI request fails, it isn&apos;t counted.</p>

      <SectionLabel>Free vs Pro</SectionLabel>
      <div className="overflow-hidden rounded-3xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-subtle text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Feature</th>
              <th className="px-4 py-3 font-medium">Free</th>
              <th className="px-4 py-3 font-medium">Pro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {limits.map((l) => (
              <tr key={l.feature}>
                <td className="px-4 py-3">{l.label}</td>
                <td className="px-4 py-3 tabular">
                  {fmt(l.freeLimit)}
                  {l.freeLimit >= 0 ? per(l.period) : ""}
                </td>
                <td className="px-4 py-3 tabular">
                  {fmt(l.proLimit)}
                  {l.proLimit >= 0 ? per(l.period) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SectionLabel>Upgrade</SectionLabel>
      {!features.billing() ? (
        <Notice>Online payments aren&apos;t set up on this server yet. Ask your advisor whether your chapter covers Pro, or check back later.</Notice>
      ) : plan.source === "subscription" ? (
        <form action="/api/stripe/portal" method="post">
          <button className="h-12 w-full rounded-full border border-border font-medium hover:bg-subtle" type="submit">
            Manage or cancel subscription
          </button>
        </form>
      ) : plan.isPro ? (
        <p className="text-muted">You already have Pro.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <form action="/api/stripe/checkout" method="post" className="rounded-3xl border border-border p-5">
            <input type="hidden" name="kind" value="pro" />
            <p className="text-lg font-semibold">Pro monthly</p>
            <p className="mt-1 text-sm text-muted">Renews monthly until you cancel. Cancel anytime from this page; you keep Pro until the end of the paid period. Price shown at checkout.</p>
            <button className="mt-4 h-12 w-full rounded-full bg-fg font-medium text-bg" type="submit">
              Continue to checkout
            </button>
          </form>
          <form action="/api/stripe/checkout" method="post" className="rounded-3xl border border-border p-5">
            <input type="hidden" name="kind" value="season_boost" />
            <p className="text-lg font-semibold">Season boost</p>
            <p className="mt-1 text-sm text-muted">One payment for Pro until July 31. Does not renew. Price shown at checkout.</p>
            <button className="mt-4 h-12 w-full rounded-full border border-border font-medium hover:bg-subtle" type="submit">
              Continue to checkout
            </button>
          </form>
        </div>
      )}
      <p className="mt-4 text-sm text-muted">Students under 18 should get a parent or guardian&apos;s permission before purchasing. No free trial converts to a paid plan automatically.</p>
    </Page>
  );
}
