import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { Target } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { BackHeader, Page } from "@/components/ui/page";
import { Card, HeroTexture } from "@/components/ui/card";
import { Markdown } from "@/components/ui/markdown";
import { cn } from "@/lib/cn";
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
  const complete = Boolean(progress?.lessonCompletedAt);
  return (
    <Page>
      <BackHeader href={`/study/learn?exam=${unit.clusterId}`} title={`Unit ${unit.position}`} subtitle={unit.title} />
      <article>
        <h1 className="text-[2rem] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-[2.35rem]">{unit.title}</h1>
        <Card tone="subtle" className="mt-5 flex gap-3 p-4 text-[15px] leading-relaxed sm:p-5">
          <Target className="mt-0.5 size-[18px] shrink-0" aria-hidden />
          <p>
            <span className="font-semibold">Learning objective: </span>
            {unit.objective}
          </p>
        </Card>
        <div className="mt-6 text-[17px]">
          <Markdown source={unit.body} />
        </div>
        {unit.examples.length ? (
          <Card className="mt-6">
            <h2 className="text-lg font-semibold tracking-[-0.02em]">Examples</h2>
            <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-muted">
              {unit.examples.map((e) => (
                <li key={e} className="flex gap-3">
                  <span aria-hidden className="mt-[0.75em] h-px w-3 shrink-0 bg-border-strong" />
                  <span>{e}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </article>
      <Card tone="inverse" className="mt-10 p-6 shadow-float sm:p-8">
        <HeroTexture />
        <div className="relative">
          <h2 className="text-[1.6rem] font-semibold leading-[1.1] tracking-[-0.03em]">{complete ? "Lesson complete" : "Check your understanding"}</h2>
          <p className="mt-2 max-w-md text-hero-muted">
            {complete ? `You got ${progress.checkCorrect} of 3 on the check. Keep practicing this unit to master it.` : "3 quick questions finish the lesson."}
          </p>
          {complete ? (
            <div className="mt-5 flex max-w-48 gap-1.5" aria-hidden>
              {[0, 1, 2].map((n) => (
                <span key={n} className={cn("h-1.5 flex-1 rounded-full", n < progress.checkCorrect ? "bg-accent" : "bg-hero-line")} />
              ))}
            </div>
          ) : null}
          <StartForm exam={unit.clusterId} mode={complete ? "unit" : "check"} unit={unit.id} resume={false} allowanceNote={null} disabled={false} />
        </div>
      </Card>
    </Page>
  );
}
