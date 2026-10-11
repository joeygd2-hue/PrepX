import Link from "next/link";
import { gte, sql, eq, and } from "drizzle-orm";
import { ArrowUpRight } from "lucide-react";
import { db, schema } from "@/db";
import { features, env } from "@/lib/env";
import { cn } from "@/lib/cn";
import { Accent, PageTitle } from "@/components/ui/page";
import { Card, HeroTexture, SectionLabel } from "@/components/ui/card";

export default async function AdminHome() {
  const day = new Date(Date.now() - 86400_000);
  const week = new Date(Date.now() - 7 * 86400_000);
  const [[users], [active], [answers], [ai], [errors], [openFb], [reviewQ]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(schema.users),
    db.select({ n: sql<number>`count(distinct ${schema.activityDays.userId})::int` }).from(schema.activityDays).where(gte(schema.activityDays.day, week.toISOString().slice(0, 10))),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.attemptAnswers).where(gte(schema.attemptAnswers.answeredAt, day)),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.usageRecords).where(and(gte(schema.usageRecords.createdAt, day), eq(schema.usageRecords.status, "consumed"))),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.errorLog).where(gte(schema.errorLog.createdAt, day)),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.feedback).where(eq(schema.feedback.status, "open")),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.questions).where(eq(schema.questions.status, "review")),
  ]);
  // The first stat is the hero; the ones with a link open the section where they're handled.
  const stats: [string, number, string?][] = [
    ["Users", users.n],
    ["Active (7 days)", active.n],
    ["Answers (24h)", answers.n],
    ["AI uses (24h)", ai.n],
    ["Errors (24h)", errors.n, "/admin/health"],
    ["Open feedback", openFb.n, "/admin/feedback"],
    ["Questions to review", reviewQ.n, "/admin/questions"],
  ];
  const [[heroLabel, heroValue], ...rest] = stats;
  const integrations: [string, boolean, string][] = [
    ["Google sign-in", features.google(), "GOOGLE_CLIENT_ID / SECRET"],
    ["Email delivery", env.email.provider !== "console", `EMAIL_PROVIDER=${env.email.provider}`],
    ["AI provider", features.ai() && !features.aiIsMock(), `AI_PROVIDER=${env.ai.provider} · model ${env.ai.model}`],
    ["Payments", features.billing(), "STRIPE_* keys"],
    ["Web push", features.push(), "VAPID keys"],
    ["Scheduled jobs", Boolean(env.cronSecret), "CRON_SECRET"],
  ];
  return (
    <div className="stagger">
      <PageTitle title={<Accent>Overview</Accent>} />
      <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card tone="inverse" className="col-span-2 flex min-h-[10rem] flex-col justify-end shadow-float">
          <HeroTexture />
          <div className="relative">
            <p className="font-mono text-[3.5rem] font-medium leading-[0.85] tracking-[-0.06em] tabular sm:text-[4.5rem]">{heroValue.toLocaleString()}</p>
            <p className="mt-3 text-hero-muted">{heroLabel}</p>
          </div>
        </Card>
        {rest.map(([label, n, href]) => {
          const body = (
            <>
              <p className="font-mono text-[2rem] font-medium leading-none tracking-[-0.04em] tabular">{n.toLocaleString()}</p>
              <p className="mt-2 text-sm text-muted">{label}</p>
            </>
          );
          const tile = "relative flex min-h-[7.5rem] flex-col justify-end rounded-[22px] border border-border bg-card p-4 shadow-card sm:p-5";
          return href ? (
            <Link key={label} href={href} className={cn(tile, "group/stat transition-[border-color,box-shadow] duration-200 hover:border-border-strong hover:shadow-float")}>
              <ArrowUpRight
                className="absolute right-4 top-4 size-4 text-muted opacity-50 transition-[transform,opacity] duration-200 group-hover/stat:-translate-y-0.5 group-hover/stat:translate-x-0.5 group-hover/stat:opacity-100 sm:right-5 sm:top-5"
                aria-hidden
              />
              {body}
            </Link>
          ) : (
            <div key={label} className={tile}>
              {body}
            </div>
          );
        })}
      </div>
      <SectionLabel>Integrations</SectionLabel>
      <ul className="divide-y divide-border rounded-[24px] border border-border bg-card px-4 shadow-card sm:px-5">
        {integrations.map(([name, ok, hint]) => (
          <li key={name} className="flex items-start justify-between gap-4 py-3.5">
            <span className="min-w-0">
              <span className="block font-medium tracking-[-0.01em]">{name}</span>
              <span className="mt-0.5 block break-words font-mono text-[13px] text-muted">{hint}</span>
            </span>
            <span className={cn("inline-flex shrink-0 items-center gap-2 pt-0.5 text-sm font-medium", ok ? "text-success" : "text-warning")}>
              <span className="size-1.5 rounded-full bg-current" aria-hidden />
              {ok ? "Configured" : "Not configured"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
