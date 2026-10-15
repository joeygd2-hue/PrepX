import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { BackHeader, Page } from "@/components/ui/page";
import { CourseReader } from "@/components/app/course/reader";
import type { ReaderPage, TermDef } from "@/components/app/course/types";
import { dedupeTerms, examplesMarkdown, lessonMinutes, markTerms, paginateLesson, splitTermTokens } from "@/lib/course";
import { checkQuestions } from "./data";

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

  const [siblings, cards, questions, [{ practice }]] = await Promise.all([
    db
      .select({ id: schema.units.id, title: schema.units.title })
      .from(schema.units)
      .where(eq(schema.units.clusterId, unit.clusterId))
      .orderBy(schema.units.position, schema.units.id),
    db
      .select({ term: schema.flashcards.term, definition: schema.flashcards.definition, unitId: schema.flashcards.unitId })
      .from(schema.flashcards)
      .where(eq(schema.flashcards.clusterId, unit.clusterId)),
    checkQuestions(user.id, unit.id, complete),
    db
      .select({ practice: sql<number>`count(*)::int` })
      .from(schema.questions)
      .where(and(eq(schema.questions.unitId, unit.id), eq(schema.questions.status, "published"))),
  ]);

  // The bank's flashcards are the glossary; this unit's own cards win when a term repeats.
  const unitTerms: TermDef[] = dedupeTerms(cards.filter((c) => c.unitId === unit.id)).map(({ term, definition }) => ({ term, definition }));
  const glossary = dedupeTerms([...unitTerms, ...cards]);
  const termNames = glossary.map((c) => c.term);
  const lessonPages = paginateLesson(unit.body);
  const examples = examplesMarkdown(unit.examples);

  const pages: ReaderPage[] = [
    { kind: "intro" },
    ...lessonPages.map((source, i): ReaderPage => ({ kind: "lesson", source: markTerms(source, termNames), part: i + 1, parts: lessonPages.length })),
    ...(examples ? [{ kind: "practice", source: markTerms(examples, termNames) } as const] : []),
    ...(unitTerms.length ? [{ kind: "terms" } as const] : []),
    ...(questions.length ? [{ kind: "check" } as const] : []),
    { kind: "finish" },
  ];

  // Only send the definitions the pages actually mark.
  const used: Record<number, TermDef> = {};
  for (const p of pages) {
    if (p.kind !== "lesson" && p.kind !== "practice") continue;
    for (const piece of splitTermTokens(p.source)) {
      if (typeof piece !== "string" && glossary[piece.term]) used[piece.term] = { term: glossary[piece.term].term, definition: glossary[piece.term].definition };
    }
  }

  const index = siblings.findIndex((s) => s.id === unit.id);
  const nextUnit = index >= 0 ? siblings[index + 1] : undefined;
  const exam = encodeURIComponent(unit.clusterId);

  return (
    <Page>
      <BackHeader href={`/study/learn?exam=${exam}`} title={`Unit ${unit.position}`} subtitle={unit.title} />
      <CourseReader
        unit={{ id: unit.id, title: unit.title, objective: unit.objective, position: unit.position }}
        pages={pages}
        glossary={used}
        unitTerms={unitTerms}
        minutes={lessonMinutes(unit, questions.length)}
        questions={questions}
        complete={complete ? { correct: progress.checkCorrect, total: questions.length } : null}
        practiceHref={practice > 0 ? `/study/practice?exam=${exam}&mode=unit&unit=${encodeURIComponent(unit.id)}` : null}
        next={nextUnit ? { href: `/study/learn/${encodeURIComponent(nextUnit.id)}`, title: nextUnit.title } : null}
        courseHref={`/study/learn?exam=${exam}`}
      />
    </Page>
  );
}
