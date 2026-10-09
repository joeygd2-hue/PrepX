import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { BackHeader, Page, EmptyState } from "@/components/ui/page";
import { Layers } from "lucide-react";
import { Deck } from "./deck";

export const metadata: Metadata = { title: "Flashcards" };

export default async function Flashcards({ searchParams }: { searchParams: Promise<{ exam?: string; filter?: string }> }) {
  const user = await requireUser();
  const { exam, filter } = await searchParams;
  if (!exam) notFound();
  const [cluster] = await db.select().from(schema.examClusters).where(eq(schema.examClusters.id, exam));
  if (!cluster) notFound();
  const rows = await db
    .select({
      id: schema.flashcards.id,
      term: schema.flashcards.term,
      definition: schema.flashcards.definition,
      unit: schema.units.title,
      box: schema.flashcardReviews.box,
      difficult: schema.flashcardReviews.difficult,
      dueAt: schema.flashcardReviews.dueAt,
      reviews: schema.flashcardReviews.reviews,
    })
    .from(schema.flashcards)
    .leftJoin(schema.units, eq(schema.units.id, schema.flashcards.unitId))
    .leftJoin(schema.flashcardReviews, and(eq(schema.flashcardReviews.cardId, schema.flashcards.id), eq(schema.flashcardReviews.userId, user.id)))
    .where(eq(schema.flashcards.clusterId, exam))
    .orderBy(sql`${schema.flashcardReviews.dueAt} nulls first`, schema.flashcards.term);
  const now = Date.now();
  const due = rows.filter((r) => !r.dueAt || r.dueAt.getTime() <= now);
  const difficult = rows.filter((r) => r.difficult);
  const deck = filter === "difficult" ? difficult : filter === "all" ? rows : due.length ? due : rows;
  const learned = rows.filter((r) => (r.box ?? 0) >= 3).length;
  return (
    <Page>
      <BackHeader href="/study" title="Flashcards" subtitle={cluster.name} />
      {rows.length === 0 ? (
        <EmptyState icon={<Layers />} title="No flashcards yet" body="Flashcards for this exam haven't been added yet." />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-subtle p-3"><p className="text-xl font-semibold tabular">{due.length}</p><p className="text-xs text-muted">due now</p></div>
            <div className="rounded-2xl bg-subtle p-3"><p className="text-xl font-semibold tabular">{learned}</p><p className="text-xs text-muted">learned</p></div>
            <div className="rounded-2xl bg-subtle p-3"><p className="text-xl font-semibold tabular">{difficult.length}</p><p className="text-xs text-muted">marked difficult</p></div>
          </div>
          <nav aria-label="Deck" className="mb-5 flex gap-2 text-sm">
            {[["", due.length ? "Due" : "All cards"], ["difficult", "Difficult"], ["all", "All"]].map(([f, label]) => (
              <a key={f} href={`?exam=${exam}${f ? `&filter=${f}` : ""}`} aria-current={(filter ?? "") === f} className={`rounded-full px-4 py-2 font-medium ${(filter ?? "") === f ? "bg-fg text-bg" : "bg-subtle"}`}>
                {label}
              </a>
            ))}
          </nav>
          <Deck cards={deck.map((c) => ({ id: c.id, term: c.term, definition: c.definition, unit: c.unit ?? "", difficult: Boolean(c.difficult) }))} />
        </>
      )}
    </Page>
  );
}
