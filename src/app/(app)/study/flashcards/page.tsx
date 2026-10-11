import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { Layers } from "lucide-react";
import { BackHeader, Page, EmptyState } from "@/components/ui/page";
import { cn } from "@/lib/cn";
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
          <div className="grid grid-cols-3 divide-x divide-border rounded-[22px] border border-border bg-card shadow-card">
            {(
              [
                [due.length, "due now"],
                [learned, "learned"],
                [difficult.length, "marked difficult"],
              ] as const
            ).map(([value, label]) => (
              <div key={label} className="min-w-0 px-4 py-4 sm:px-5">
                <p className="font-mono text-2xl font-medium tracking-[-0.04em] tabular sm:text-[1.75rem]">{value}</p>
                <p className="mt-0.5 text-[13px] leading-snug text-muted">{label}</p>
              </div>
            ))}
          </div>
          <nav aria-label="Deck" className="mt-3 mb-6 grid grid-cols-3 gap-1 rounded-[14px] bg-subtle p-1 text-sm">
            {[["", due.length ? "Due" : "All cards"], ["difficult", "Difficult"], ["all", "All"]].map(([f, label]) => (
              <a
                key={f}
                href={`?exam=${exam}${f ? `&filter=${f}` : ""}`}
                aria-current={(filter ?? "") === f}
                className={cn(
                  "flex h-10 items-center justify-center rounded-[11px] font-medium transition-colors",
                  (filter ?? "") === f ? "bg-card text-fg shadow-card" : "text-muted hover:text-fg",
                )}
              >
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
