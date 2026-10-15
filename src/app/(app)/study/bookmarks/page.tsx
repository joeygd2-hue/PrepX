import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowRight, Bookmark, ChevronDown } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { bookmarkBanks, listBookmarks } from "@/server/bookmarks";
import { MODES } from "@/server/exams";
import { BackHeader, EmptyState, Page } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { ListGroup, ListRow } from "@/components/ui/list";
import { BookmarkControls } from "./bookmark-controls";

export const metadata: Metadata = { title: "Bookmarks" };
const LETTERS = ["A", "B", "C", "D", "E", "F"];

export default async function BookmarksPage({ searchParams }: { searchParams: Promise<{ exam?: string | string[] }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  // A repeated ?exam= arrives as an array; only a single bank id is meaningful.
  const exam = typeof sp.exam === "string" ? sp.exam.slice(0, 100) : undefined;

  if (!exam) {
    const banks = await bookmarkBanks(user.id);
    return (
      <Page>
        <BackHeader href="/study" title="Bookmarks" subtitle="Saved questions and your private notes" />
        {banks.length ? (
          <ListGroup>
            {banks.map((b) => (
              <ListRow key={b.id} icon={<Bookmark className="size-[18px]" aria-hidden />} title={b.name} subtitle={`${b.count} saved question${b.count === 1 ? "" : "s"}`} href={`/study/bookmarks?exam=${encodeURIComponent(b.id)}`} />
            ))}
          </ListGroup>
        ) : (
          <EmptyState icon={<Bookmark aria-hidden />} title="No bookmarks yet" body="After you answer a practice question, tap the bookmark to save it here with a private note." />
        )}
      </Page>
    );
  }

  const [cluster] = await db.select({ id: schema.examClusters.id, name: schema.examClusters.name }).from(schema.examClusters).where(eq(schema.examClusters.id, exam));
  if (!cluster) notFound();
  const items = await listBookmarks(user.id, cluster.id);
  const practiceCount = Math.min(items.length, MODES.bookmarks.count);

  return (
    <Page>
      <BackHeader href="/study" title="Bookmarks" subtitle={cluster.name} />
      {items.length ? (
        <>
          <Card tone="subtle" className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <p className="min-w-0 flex-1 text-[15px]">
              <span className="font-mono font-medium tabular">{items.length}</span> saved question{items.length === 1 ? "" : "s"}
              <span className="block text-sm text-muted">Notes are private to you.</span>
            </p>
            <ButtonLink href={`/study/practice?exam=${encodeURIComponent(cluster.id)}&mode=bookmarks`} variant="accent">
              Practice bookmarks <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-0.5" aria-hidden />
            </ButtonLink>
            {items.length > practiceCount ? <p className="w-full text-sm text-muted">Each round picks {practiceCount} at random.</p> : null}
          </Card>
          <ol className="stagger mt-4 space-y-3">
            {items.map((it) => (
              <li key={it.id}>
                <Card>
                  <p className="text-xs text-muted">
                    {it.unitTitle ?? "General"}
                    {it.source === "ai_generated" ? " · AI-generated practice question" : ""}
                  </p>
                  <p className="mt-1.5 font-medium leading-snug tracking-[-0.01em]">{it.stem}</p>
                  <p className="mt-3 rounded-[12px] bg-success/10 px-3 py-2 text-sm leading-relaxed">
                    <span className="text-success">Correct:</span> {LETTERS[it.answerIndex]}. {it.choices[it.answerIndex]}
                  </p>
                  <details className="group mt-3 text-sm text-muted">
                    <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-[8px] font-medium transition-colors hover:text-fg [&::-webkit-details-marker]:hidden">
                      Explanation
                      <ChevronDown className="size-4 transition-transform duration-200 group-open:rotate-180" aria-hidden />
                    </summary>
                    <p className="mt-1 leading-relaxed">{it.explanation}</p>
                  </details>
                  <BookmarkControls questionId={it.id} initial={{ bookmarked: true, note: it.note }} saved className="mt-2 border-t border-border pt-3" />
                </Card>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <EmptyState
          icon={<Bookmark aria-hidden />}
          title="No bookmarks in this bank yet"
          body="After you answer a practice question, tap the bookmark to save it here. Add a private note to remember why the answer is right."
          action={
            <ButtonLink href={`/study/practice?exam=${encodeURIComponent(cluster.id)}&mode=quick10`} variant="primary">
              Start a Quick 10 <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-0.5" aria-hidden />
            </ButtonLink>
          }
        />
      )}
    </Page>
  );
}
