import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { getAllowance, getPlanStatus, type Feature } from "@/server/entitlements";
import { CHECKOUT_REFUSALS } from "@/server/billing";
import { features } from "@/lib/env";
import { formatDay } from "@/lib/dates";
import { Accent, BackHeader, Page } from "@/components/ui/page";
import { Notice } from "@/components/ui/form";
import { Card, HeroTexture, SectionLabel } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress";

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
  // A recurring subscription that hasn't ended is managed in the billing portal, never bought again.
  const openSubscription = sub?.kind === "subscription" && !["canceled", "incomplete_expired"].includes(sub.status);
  const launchEnds = plan.source === "launch" && plan.detail ? formatDay(plan.detail, { month: "long", day: "numeric", year: "numeric" }) : null;
  return (
    <Page>
      <BackHeader href="/profile" title="Your plan" />
      {checkout === "returned" ? (
        <Notice className="mb-4">
          {plan.isPro ? "Payment confirmed. Pro is active." : "We're confirming your payment with our payment provider. This page will show Pro once it's confirmed (usually within a minute). Refresh to check."}
        </Notice>
      ) : null}
      {checkout === "cancelled" ? <Notice className="mb-4">Checkout cancelled. You weren&apos;t charged.</Notice> : null}
      {checkout === "subscription_open" ? <Notice className="mb-4">{CHECKOUT_REFUSALS.subscription_open}</Notice> : null}

      <Card tone="inverse" className="p-6 shadow-float sm:p-8">
        <HeroTexture />
        <div className="relative">
          {plan.source === "launch" ? (
            <>
              <p className="eyebrow !text-hero-muted">Current plan · Pro</p>
              <h2 className="mt-6 text-[2rem] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[2.4rem]">
                Everything is <Accent>free</Accent> during launch
              </h2>
              <p className="mt-3 max-w-md text-hero-muted">
                {launchEnds ? (
                  <>
                    Pro features are unlocked for everyone until <span className="font-medium text-hero-fg">{launchEnds}</span>. No card needed.
                  </>
                ) : (
                  "Pro features are unlocked for everyone. No card needed."
                )}
              </p>
            </>
          ) : (
            <>
              <p className="eyebrow !text-hero-muted">Current plan</p>
              <p className="mt-6 flex items-center gap-3 text-[3rem] font-semibold leading-none tracking-[-0.045em]">
                {plan.isPro ? "Pro" : "Free"}
                {plan.isPro ? <span aria-hidden className="size-2.5 rounded-full bg-accent" /> : null}
              </p>
              <p className="mt-4 max-w-md text-hero-muted">
                {plan.source === "chapter"
                  ? `Covered by ${plan.detail}. Your chapter pays for Pro for its members.`
                  : plan.source === "season_boost"
                    ? `Season boost · active until ${sub?.currentPeriodEnd?.toLocaleDateString() ?? "the end of the season"}. Does not renew.`
                    : plan.source === "subscription"
                      ? `${sub?.cancelAtPeriodEnd ? "Ends" : "Renews"} ${sub?.currentPeriodEnd?.toLocaleDateString() ?? ""}`
                      : "Practice tests (within limits), lessons, flashcards and daily AI practice."}
              </p>
            </>
          )}
        </div>
      </Card>

      <SectionLabel>Your allowances</SectionLabel>
      <ul className="divide-y divide-border overflow-hidden rounded-[24px] border border-border bg-card px-4 shadow-card sm:px-5">
        {allowances.map((a) => (
          <li key={a.feature} className="flex items-center gap-4 py-3.5">
            <span className="min-w-0 flex-1">
              <span className="block font-medium tracking-[-0.01em]">{a.label}</span>
              <span className="mt-0.5 block text-sm text-muted">{a.unlimited ? "Unlimited" : `${a.used} of ${a.limit} used · ${a.resets}`}</span>
              {a.unlimited ? null : <ProgressBar value={a.used} max={a.limit} label={a.label} className="mt-2.5" />}
            </span>
            <Chip className="shrink-0 font-mono tabular">{a.unlimited ? "∞" : `${a.remaining} left`}</Chip>
          </li>
        ))}
      </ul>
      <p className="mt-3 px-1 text-xs text-muted">If an AI request fails, it isn&apos;t counted.</p>

      <SectionLabel>Free vs Pro</SectionLabel>
      <div className="overflow-hidden rounded-[24px] border border-border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th scope="col" className="px-4 pb-3 pt-5 text-left align-bottom font-normal sm:px-5">
                <span className="eyebrow">Feature</span>
              </th>
              <th scope="col" className="px-3 pb-3 pt-5 text-right align-bottom font-normal">
                <span className="eyebrow">Free</span>
              </th>
              <th scope="col" className="bg-subtle/70 px-3 pb-3 pt-5 text-right align-bottom sm:px-5">
                <span className="inline-flex h-6 items-center rounded-full bg-primary px-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-primary-fg">Pro</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {limits.map((l) => (
              <tr key={l.feature} className="border-t border-border">
                <th scope="row" className="px-4 py-3.5 text-left font-normal leading-snug sm:px-5">
                  {l.label}
                </th>
                <td className="whitespace-nowrap px-3 py-3.5 text-right font-mono text-[13px] text-muted tabular">
                  {fmt(l.freeLimit)}
                  {l.freeLimit >= 0 ? per(l.period) : ""}
                </td>
                <td className="whitespace-nowrap bg-subtle/70 px-3 py-3.5 text-right font-mono text-[13px] font-medium tabular sm:px-5">
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
      ) : openSubscription ? (
        <form action="/api/stripe/portal" method="post">
          <Button type="submit" variant="outline" block>
            Manage or cancel subscription
          </Button>
        </form>
      ) : plan.isPro ? (
        <p className="px-1 text-muted">You already have Pro.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="flex flex-col">
            <form action="/api/stripe/checkout" method="post" className="flex flex-1 flex-col">
              <input type="hidden" name="kind" value="pro" />
              <p className="text-lg font-semibold tracking-[-0.02em]">Pro monthly</p>
              <p className="mt-1 flex-1 text-sm leading-relaxed text-muted">Renews monthly until you cancel. Cancel anytime from this page; you keep Pro until the end of the paid period. Price shown at checkout.</p>
              <Button type="submit" variant="accent" block className="mt-5">
                Continue to checkout
              </Button>
            </form>
          </Card>
          <Card className="flex flex-col">
            <form action="/api/stripe/checkout" method="post" className="flex flex-1 flex-col">
              <input type="hidden" name="kind" value="season_boost" />
              <p className="text-lg font-semibold tracking-[-0.02em]">Season boost</p>
              <p className="mt-1 flex-1 text-sm leading-relaxed text-muted">One payment for Pro until July 31. Does not renew. Price shown at checkout.</p>
              <Button type="submit" variant="outline" block className="mt-5">
                Continue to checkout
              </Button>
            </form>
          </Card>
        </div>
      )}
      <p className="mt-4 px-1 text-sm text-muted">Students under 18 should get a parent or guardian&apos;s permission before purchasing. No free trial converts to a paid plan automatically.</p>
    </Page>
  );
}
