import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { getAllowance } from "@/server/entitlements";
import { BackHeader, Page, EmptyState } from "@/components/ui/page";
import { Notice } from "@/components/ui/form";
import { features } from "@/lib/env";
import { MessagesSquare } from "lucide-react";
import { ExplainDrill } from "./drill";

export const metadata: Metadata = { title: "Explain it back" };

export default async function Explain({ searchParams }: { searchParams: Promise<{ exam?: string }> }) {
  const user = await requireUser();
  const { exam } = await searchParams;
  if (!exam) notFound();
  // Prefer cards marked difficult or never reviewed.
  const cards = await db
    .select({ id: schema.flashcards.id, term: schema.flashcards.term })
    .from(schema.flashcards)
    .leftJoin(schema.flashcardReviews, and(eq(schema.flashcardReviews.cardId, schema.flashcards.id), eq(schema.flashcardReviews.userId, user.id)))
    .where(eq(schema.flashcards.clusterId, exam))
    .orderBy(sql`coalesce(${schema.flashcardReviews.difficult}, false) desc`, sql`${schema.flashcardReviews.box} nulls first`, sql`random()`)
    .limit(10);
  const allowance = await getAllowance(user.id, "explain_back", user.profile!.timezone);
  return (
    <Page>
      <BackHeader href="/study" title="Explain it back" />
      {!features.ai() ? <Notice tone="warning" className="mb-4">AI features aren&apos;t configured on this server yet.</Notice> : null}
      {cards.length ? (
        <ExplainDrill cards={cards} remaining={allowance.unlimited ? null : allowance.remaining} />
      ) : (
        <EmptyState icon={<MessagesSquare />} title="No terms yet" body="Key terms for this exam haven't been added yet." />
      )}
    </Page>
  );
}
