import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { db, schema } from "@/db";
import { PublicPage, PublicTitle } from "@/components/shell/public-page";
import { ButtonLink } from "@/components/ui/button";
import { Card, HeroTexture } from "@/components/ui/card";
import { Accent } from "@/components/ui/page";
import { cn } from "@/lib/cn";
import { getLaunchAccess } from "@/server/settings";
import { LaunchBanner } from "@/components/app/launch-banner";

export const metadata: Metadata = { title: "Pricing" };

type Row = { id: string; label: string; free: React.ReactNode; pro: React.ReactNode };

export default async function Pricing() {
  const [limits, launch] = await Promise.all([db.select().from(schema.planLimits), getLaunchAccess()]);
  const fmt = (n: number, p: string) =>
    n < 0 ? (
      "Unlimited"
    ) : (
      <>
        <span className="font-mono tabular">{n}</span>
        {p === "day" ? " / day" : p === "season" ? " / season" : ""}
      </>
    );
  const rows: Row[] = [
    ...limits.map((l) => ({ id: l.feature, label: l.label, free: fmt(l.freeLimit, l.period), pro: fmt(l.proLimit, l.period) })),
    { id: "practice", label: "Quick 10, sprints, mistake notebook", free: "Unlimited", pro: "Unlimited" },
    { id: "chapter", label: "Chapters, check-ins, quiz night, calendar", free: "Included", pro: "Included" },
  ];
  return (
    <PublicPage wide>
      <PublicTitle
        title={<Accent>Pricing</Accent>}
        lead="Start free. Upgrade for more AI practice, or ask whether your chapter covers Pro. Prices are shown at checkout."
      />
      {launch.active && launch.endsOn ? (
        <div className="mb-4">
          <LaunchBanner endsOn={launch.endsOn} />
        </div>
      ) : null}
      <div className="stagger grid gap-3 md:grid-cols-2">
        <Card className="flex flex-col p-6 sm:p-8">
          <p className="eyebrow">Start free</p>
          <h2 className="mt-3 text-[2rem] font-semibold leading-none tracking-[-0.035em]">Free</h2>
          <Limits rows={rows} plan="free" />
          <ButtonLink href="/sign-in" size="lg" block className="mt-auto">
            Get started free <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-0.5" aria-hidden />
          </ButtonLink>
        </Card>
        <Card tone="inverse" className="flex flex-col rounded-[28px] p-6 shadow-float sm:p-8">
          <HeroTexture />
          <div className="relative flex flex-1 flex-col">
            <p className="eyebrow !text-hero-muted">More AI practice</p>
            <h2 className="mt-3 text-[2rem] font-semibold leading-none tracking-[-0.035em]">Pro</h2>
            <Limits rows={rows} plan="pro" />
            <p className="mt-auto text-sm leading-relaxed text-hero-muted">
              Pro renews monthly until cancelled. A season boost is a one-time purchase that ends July 31. No automatic trial conversions.
            </p>
          </div>
        </Card>
      </div>
    </PublicPage>
  );
}

function Limits({ rows, plan }: { rows: Row[]; plan: "free" | "pro" }) {
  const hero = plan === "pro";
  return (
    <dl className={cn("mb-8 mt-7 divide-y border-y text-[15px]", hero ? "divide-hero-line border-hero-line" : "divide-border border-border")}>
      {rows.map((r) => (
        <div key={r.id} className="flex items-baseline justify-between gap-4 py-3">
          <dt className={cn("min-w-0", hero ? "text-hero-muted" : "text-muted")}>{r.label}</dt>
          <dd className="shrink-0 text-right font-medium">{r[plan]}</dd>
        </div>
      ))}
    </dl>
  );
}
