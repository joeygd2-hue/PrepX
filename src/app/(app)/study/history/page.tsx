import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { MODES, type Mode } from "@/server/exams";
import { BackHeader, Page, EmptyState } from "@/components/ui/page";
import { History } from "lucide-react";

export const metadata: Metadata = { title: "Attempt history" };

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ exam?: string }> }) {
  const user = await requireUser();
  const { exam } = await searchParams;
  if (!exam) notFound();
  const attempts = await db
    .select()
    .from(schema.examAttempts)
    .where(and(eq(schema.examAttempts.userId, user.id), eq(schema.examAttempts.clusterId, exam), isNotNull(schema.examAttempts.submittedAt)))
    .orderBy(desc(schema.examAttempts.submittedAt))
    .limit(100);
  const judged = await db
    .select({ id: schema.aiSessions.id, kind: schema.aiSessions.kind, title: schema.aiSessions.title, createdAt: schema.aiSessions.createdAt, score: schema.aiFeedback.score })
    .from(schema.aiSessions)
    .innerJoin(schema.aiFeedback, eq(schema.aiFeedback.sessionId, schema.aiSessions.id))
    .where(eq(schema.aiSessions.userId, user.id))
    .orderBy(desc(schema.aiSessions.createdAt))
    .limit(30);
  const pcts = attempts.filter((a) => a.mode !== "sprint" && a.total).map((a) => Math.round(((a.correct ?? 0) / a.total!) * 100)).reverse();
  return (
    <Page>
      <BackHeader href="/study" title="History" />
      {pcts.length > 1 ? (
        <section className="mb-6 rounded-3xl border border-border p-5" aria-label="Score trend">
          <p className="eyebrow">Score trend</p>
          <svg viewBox={`0 0 ${Math.max(pcts.length - 1, 1) * 20} 100`} className="mt-3 h-24 w-full" preserveAspectRatio="none" role="img" aria-label={`Scores from ${pcts[0]}% to ${pcts.at(-1)}%`}>
            <polyline fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" points={pcts.map((p, i) => `${i * 20},${100 - p}`).join(" ")} />
          </svg>
          <p className="mt-2 text-sm text-muted">
            First {pcts[0]}% → latest {pcts.at(-1)}%
          </p>
        </section>
      ) : null}
      {!attempts.length && !judged.length ? (
        <EmptyState icon={<History />} title="No attempts yet" body="Finished practice tests and judge runs will show up here." />
      ) : null}
      {attempts.length ? (
        <ul className="divide-y divide-border rounded-3xl border border-border px-5">
          {attempts.map((a) => (
            <li key={a.id}>
              <Link href={`/study/attempt/${a.id}/review`} className="-mx-5 flex items-center justify-between gap-4 px-5 py-4 hover:bg-subtle/60">
                <span>
                  <span className="block font-medium">{MODES[a.mode as Mode]?.label ?? a.mode}</span>
                  <span className="text-sm text-muted">{a.submittedAt!.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                </span>
                <span className="font-semibold tabular">{a.mode === "sprint" ? `${a.correct} in 60s` : `${a.correct}/${a.total}`}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {judged.length ? (
        <>
          <h2 className="eyebrow mt-8 mb-3">AI feedback</h2>
          <ul className="divide-y divide-border rounded-3xl border border-border px-5">
            {judged.map((j) => (
              <li key={j.id}>
                <Link href={`/study/judge/${j.id}`} className="-mx-5 flex items-center justify-between gap-4 px-5 py-4 hover:bg-subtle/60">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{j.title || j.kind}</span>
                    <span className="text-sm text-muted">{j.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  </span>
                  <span className="font-semibold tabular">{j.score}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </Page>
  );
}
