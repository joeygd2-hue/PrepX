import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { BookOpen, ChevronRight, FileText, Gauge, History, MessageCircle, Mic, Presentation, Repeat, Timer, User, Zap } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { MODES, type Mode } from "@/server/exams";
import { BackHeader, Page, EmptyState } from "@/components/ui/page";
import { HeroTexture, SectionLabel } from "@/components/ui/card";
import { ListGroup, ListRow } from "@/components/ui/list";

export const metadata: Metadata = { title: "Attempt history" };

const MODE_ICONS: Record<string, React.ComponentType> = { quick10: Zap, full: FileText, rehearsal: Timer, sprint: Gauge, mistakes: Repeat, unit: BookOpen, check: BookOpen };
const KIND_ICONS: Record<string, React.ComponentType> = { judge: Mic, face_to_face: User, entry_check: FileText, presentation_check: Presentation };

function Score({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex shrink-0 items-center gap-2">
      <span className="font-mono text-[15px] font-medium tracking-[-0.02em] tabular">{children}</span>
      <ChevronRight className="size-4 text-muted transition-transform duration-200 group-hover/row:translate-x-0.5 group-hover/row:text-fg" aria-hidden />
    </span>
  );
}

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
  const width = Math.max(pcts.length - 1, 1) * 20;
  const line = pcts.map((p, i) => `${i * 20},${100 - p}`).join(" ");
  return (
    <Page>
      <BackHeader href="/study" title="History" />
      {pcts.length > 1 ? (
        <section className="relative overflow-hidden rounded-[28px] bg-hero p-6 text-hero-fg shadow-float sm:p-8" aria-label="Score trend">
          <HeroTexture />
          <div className="relative">
            <p className="eyebrow !text-hero-muted">Score trend</p>
            <div className="relative mt-6 h-28">
              <svg viewBox={`0 0 ${width} 100`} className="absolute inset-0 size-full overflow-visible" preserveAspectRatio="none" role="img" aria-label={`Scores from ${pcts[0]}% to ${pcts.at(-1)}%`}>
                {[0, 50, 100].map((y) => (
                  <line key={y} x1={0} x2={width} y1={y} y2={y} stroke="var(--hero-line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                ))}
                <polygon points={`0,100 ${line} ${width},100`} fill="var(--accent)" fillOpacity={0.14} />
                <polyline fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" points={line} />
              </svg>
              <span
                aria-hidden
                className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-4 ring-accent/25"
                style={{ left: "100%", top: `${100 - pcts.at(-1)!}%` }}
              />
            </div>
            <p className="mt-5 text-sm text-hero-muted">
              First <span className="font-mono font-medium text-hero-fg tabular">{pcts[0]}%</span> → latest <span className="font-mono font-medium text-hero-fg tabular">{pcts.at(-1)}%</span>
            </p>
          </div>
        </section>
      ) : null}
      {!attempts.length && !judged.length ? (
        <EmptyState icon={<History />} title="No attempts yet" body="Finished practice tests and judge runs will show up here." />
      ) : null}
      {attempts.length ? (
        <>
          <SectionLabel className={pcts.length > 1 ? undefined : "mt-0"}>Practice</SectionLabel>
          <ListGroup>
            {attempts.map((a) => {
              const Icon = MODE_ICONS[a.mode] ?? FileText;
              return (
                <ListRow
                  key={a.id}
                  href={`/study/attempt/${a.id}/review`}
                  icon={<Icon />}
                  title={MODES[a.mode as Mode]?.label ?? a.mode}
                  subtitle={a.submittedAt!.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  right={<Score>{a.mode === "sprint" ? `${a.correct} in 60s` : `${a.correct}/${a.total}`}</Score>}
                />
              );
            })}
          </ListGroup>
        </>
      ) : null}
      {judged.length ? (
        <>
          <SectionLabel className={attempts.length ? undefined : "mt-0"}>AI feedback</SectionLabel>
          <ListGroup>
            {judged.map((j) => {
              const Icon = KIND_ICONS[j.kind] ?? MessageCircle;
              return (
                <ListRow
                  key={j.id}
                  href={`/study/judge/${j.id}`}
                  icon={<Icon />}
                  title={<span className="block truncate">{j.title || j.kind}</span>}
                  subtitle={j.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  right={<Score>{j.score}</Score>}
                />
              );
            })}
          </ListGroup>
        </>
      ) : null}
    </Page>
  );
}
