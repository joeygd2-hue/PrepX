import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { BackHeader, Page } from "@/components/ui/page";
import { Markdown } from "@/components/ui/markdown";
import { StartForm } from "../../practice/start-form";

export async function generateMetadata({ params }: { params: Promise<{ unitId: string }> }): Promise<Metadata> {
  const { unitId } = await params;
  const [u] = await db.select({ title: schema.units.title }).from(schema.units).where(eq(schema.units.id, unitId));
  return { title: u?.title ?? "Lesson" };
}

export default async function Lesson({ params }: { params: Promise<{ unitId: string }> }) {
  const user = await requireUser();
  const { unitId } = await params;
  const [unit] = await db.select().from(schema.units).where(eq(schema.units.id, unitId));
  if (!unit) notFound();
  await db.insert(schema.lessonProgress).values({ userId: user.id, unitId }).onConflictDoNothing();
  const [progress] = await db.select().from(schema.lessonProgress).where(and(eq(schema.lessonProgress.userId, user.id), eq(schema.lessonProgress.unitId, unitId)));
  return (
    <Page>
      <BackHeader href={`/study/learn?exam=${unit.clusterId}`} title={`Unit ${unit.position}`} subtitle={unit.title} />
      <article>
        <h1 className="text-3xl font-semibold tracking-tight">{unit.title}</h1>
        <p className="mt-3 rounded-2xl bg-subtle p-4 text-sm">
          <span className="font-semibold">Learning objective: </span>
          {unit.objective}
        </p>
        <div className="mt-6 text-[17px]">
          <Markdown source={unit.body} />
        </div>
        {unit.examples.length ? (
          <section className="mt-6 rounded-3xl border border-border p-5">
            <h2 className="font-semibold">Examples</h2>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-muted">
              {unit.examples.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>
      <section className="mt-8 rounded-3xl bg-subtle p-6">
        <h2 className="text-xl font-semibold">{progress?.lessonCompletedAt ? "Lesson complete" : "Check your understanding"}</h2>
        <p className="mt-1 text-muted">
          {progress?.lessonCompletedAt ? `You got ${progress.checkCorrect} of 3 on the check. Keep practicing this unit to master it.` : "3 quick questions finish the lesson."}
        </p>
        <StartForm exam={unit.clusterId} mode={progress?.lessonCompletedAt ? "unit" : "check"} unit={unit.id} resume={false} allowanceNote={null} disabled={false} />
      </section>
    </Page>
  );
}
