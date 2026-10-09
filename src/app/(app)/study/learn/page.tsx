import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ChevronRight, CheckCircle2, Circle, CircleDot } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { unitMastery } from "@/server/progress";
import { BackHeader, Page, EmptyState } from "@/components/ui/page";
import { ProgressBar } from "@/components/ui/progress";
import { Chip } from "@/components/ui/badge";
import { BookOpen } from "lucide-react";

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
          <Link href={next ? `/study/learn/${next.unit.id}` : "#"} className="block rounded-3xl bg-fg p-6 text-bg hover:opacity-95">
            <p className="eyebrow !text-bg/70">
              {done} of {units.length} lessons · {mastered} mastered
            </p>
            <ProgressBar value={done} max={units.length} inverse className="mt-3" label="Lessons completed" />
            <p className="mt-4 text-lg font-semibold">{next ? `${next.lessonDone ? "Practice" : "Start"}: ${next.unit.title} →` : "All units mastered. Nice work!"}</p>
          </Link>
          <p className="my-6 text-muted">Each unit: a 5-minute lesson with 3 check questions, then practice. A unit is mastered at 80% on your last 15+ questions.</p>
          <ol className="divide-y divide-border rounded-3xl border border-border px-5">
            {units.map((u) => (
              <li key={u.unit.id}>
                <Link href={`/study/learn/${u.unit.id}`} className="-mx-5 flex items-center gap-4 px-5 py-5 hover:bg-subtle/60">
                  {u.mastered ? <CheckCircle2 className="size-6 shrink-0 fill-fg text-bg" aria-hidden /> : u.lessonDone ? <CircleDot className="size-6 shrink-0" aria-hidden /> : <Circle className="size-6 shrink-0" aria-hidden />}
                  <span className="min-w-0 flex-1">
                    <span className="eyebrow block !text-[11px]">Unit {u.unit.position}</span>
                    <span className="block font-semibold">{u.unit.title}</span>
                    <span className="mt-1 inline-block">
                      <Chip>
                        {u.status}
                        {u.recentAnswered ? ` · ${Math.round((u.recentAccuracy ?? 0) * 100)}% on last ${u.recentAnswered}` : ""}
                      </Chip>
                    </span>
                  </span>
                  <ChevronRight className="size-5 text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ol>
        </>
      )}
    </Page>
  );
}
