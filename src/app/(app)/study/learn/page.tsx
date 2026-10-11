import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { BookOpen, Check, ChevronRight } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { unitMastery } from "@/server/progress";
import { BackHeader, Page, EmptyState } from "@/components/ui/page";
import { HeroTexture, SectionLabel } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { Chip } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Lessons" };

export default async function Lessons({ searchParams }: { searchParams: Promise<{ exam?: string }> }) {
  const user = await requireUser();
  const { exam } = await searchParams;
  if (!exam) notFound();
  const [cluster] = await db.select().from(schema.examClusters).where(eq(schema.examClusters.id, exam));
  if (!cluster) notFound();
  const units = await unitMastery(user.id, exam);
  const done = units.filter((u) => u.lessonDone).length;
  const mastered = units.filter((u) => u.mastered).length;
  const next = units.find((u) => !u.lessonDone) ?? units.find((u) => !u.mastered);
  return (
    <Page>
      <BackHeader href="/study" title="Lessons" subtitle={cluster.name} />
      {!units.length ? (
        <EmptyState icon={<BookOpen />} title="No lessons yet" body="Lessons for this exam haven't been written yet. Try the AI coach in the meantime." />
      ) : (
        <>
          <Link
            href={next ? `/study/learn/${next.unit.id}` : "#"}
            className="group/hero relative block overflow-hidden rounded-[28px] bg-hero p-6 text-hero-fg shadow-float transition-transform duration-300 hover:-translate-y-0.5 sm:p-8"
          >
            <HeroTexture />
            <div className="relative">
              <p className="eyebrow !text-hero-muted">
                {done} of {units.length} lessons · {mastered} mastered
              </p>
              <p className="mt-6 max-w-md text-[1.5rem] font-semibold leading-[1.15] tracking-[-0.03em] sm:text-[1.75rem]">
                {next ? (
                  <>
                    {`${next.lessonDone ? "Practice" : "Start"}: ${next.unit.title}`}{" "}
                    <span className="inline-block transition-transform duration-300 group-hover/hero:translate-x-1" aria-hidden>
                      →
                    </span>
                  </>
                ) : (
                  "All units mastered. Nice work!"
                )}
              </p>
              <ProgressBar value={done} max={units.length} inverse className="mt-7" label="Lessons completed" />
            </div>
          </Link>
          <p className="mt-5 text-sm leading-relaxed text-muted">Each unit: a 5-minute lesson with 3 check questions, then practice. A unit is mastered at 80% on your last 15+ questions.</p>
          <SectionLabel>Units</SectionLabel>
          <ol className="divide-y divide-border overflow-hidden rounded-[24px] border border-border bg-card px-4 shadow-card sm:px-5">
            {units.map((u) => (
              <li key={u.unit.id}>
                <Link href={`/study/learn/${u.unit.id}`} className="group/row -mx-4 flex items-center gap-3.5 px-4 py-4 transition-colors hover:bg-subtle/60 sm:-mx-5 sm:px-5">
                  {u.mastered ? (
                    <span aria-hidden className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg">
                      <Check className="size-4" strokeWidth={3} />
                    </span>
                  ) : u.lessonDone ? (
                    <span aria-hidden className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border-[1.5px] border-fg">
                      <span className="size-2 rounded-full bg-primary" />
                    </span>
                  ) : (
                    <span aria-hidden className="size-7 shrink-0 rounded-full border-[1.5px] border-border-strong" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="eyebrow block">Unit {u.unit.position}</span>
                    <span className="mt-0.5 block font-semibold leading-snug tracking-[-0.01em]">{u.unit.title}</span>
                    <span className="mt-2 inline-block">
                      <Chip className="tabular">
                        {u.status}
                        {u.recentAnswered ? ` · ${Math.round((u.recentAccuracy ?? 0) * 100)}% on last ${u.recentAnswered}` : ""}
                      </Chip>
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted transition-transform duration-200 group-hover/row:translate-x-0.5 group-hover/row:text-fg" aria-hidden />
                </Link>
              </li>
            ))}
          </ol>
        </>
      )}
    </Page>
  );
}
