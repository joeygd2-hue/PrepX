import { gte, sql, eq, and } from "drizzle-orm";
import { db, schema } from "@/db";
import { features, env } from "@/lib/env";

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
  const stats: [string, number][] = [
    ["Users", users.n],
    ["Active (7 days)", active.n],
    ["Answers (24h)", answers.n],
    ["AI uses (24h)", ai.n],
    ["Errors (24h)", errors.n],
    ["Open feedback", openFb.n],
    ["Questions to review", reviewQ.n],
  ];
  const integrations: [string, boolean, string][] = [
    ["Google sign-in", features.google(), "GOOGLE_CLIENT_ID / SECRET"],
    ["Email delivery", env.email.provider !== "console", `EMAIL_PROVIDER=${env.email.provider}`],
    ["AI provider", features.ai() && !features.aiIsMock(), `AI_PROVIDER=${env.ai.provider} · model ${env.ai.model}`],
    ["Payments", features.billing(), "STRIPE_* keys"],
    ["Web push", features.push(), "VAPID keys"],
    ["Scheduled jobs", Boolean(env.cronSecret), "CRON_SECRET"],
  ];
  return (
    <div>
      <h1 className="text-3xl font-semibold">Overview</h1>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([l, n]) => (
          <div key={l} className="rounded-3xl bg-subtle p-5">
            <p className="text-3xl font-semibold tabular">{n}</p>
            <p className="text-sm text-muted">{l}</p>
          </div>
        ))}
      </div>
      <h2 className="eyebrow mt-10 mb-3">Integrations</h2>
      <ul className="divide-y divide-border rounded-3xl border border-border px-5">
        {integrations.map(([name, ok, hint]) => (
          <li key={name} className="flex items-center justify-between gap-3 py-3">
            <span>
              <span className="font-medium">{name}</span>
              <span className="ml-2 text-sm text-muted">{hint}</span>
            </span>
            <span className={ok ? "text-success" : "text-warning"}>{ok ? "Configured" : "Not configured"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
