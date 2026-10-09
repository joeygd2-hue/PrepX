import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { Gamepad2 } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { BackHeader, Page, EmptyState } from "@/components/ui/page";
import { ButtonLink } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/card";
import { HostForm } from "./host-form";

export const metadata: Metadata = { title: "Quiz night" };

export default async function QuizHome() {
  const user = await requireUser();
  const mine = await db
    .select({ chapter: schema.chapters, role: schema.chapterMembers.role })
    .from(schema.chapterMembers)
    .innerJoin(schema.chapters, eq(schema.chapters.id, schema.chapterMembers.chapterId))
    .where(eq(schema.chapterMembers.userId, user.id));
  if (!mine.length)
    return (
      <Page>
        <BackHeader href="/" title="Quiz night" />
        <EmptyState icon={<Gamepad2 />} title="Join a chapter to play" body="Quiz night is a live game your chapter's officers host at meetings." action={<ButtonLink href="/join">Enter a join code</ButtonLink>} />
      </Page>
    );
  const games = await db
    .select()
    .from(schema.quizGames)
    .where(and(inArray(schema.quizGames.chapterId, mine.map((m) => m.chapter.id)), gt(schema.quizGames.createdAt, new Date(Date.now() - 12 * 3600_000))))
    .orderBy(desc(schema.quizGames.createdAt));
  const hostable = mine.filter((m) => m.role !== "member");
  const clusters = hostable.length
    ? await db
        .select({ id: schema.examClusters.id, name: schema.examClusters.name, org: schema.examClusters.org, n: sql<number>`count(${schema.questions.id})::int` })
        .from(schema.examClusters)
        .innerJoin(schema.questions, eq(schema.questions.clusterId, schema.examClusters.id))
        .groupBy(schema.examClusters.id)
    : [];
  return (
    <Page>
      <BackHeader href="/chapter" title="Quiz night" />
      {games.filter((g) => g.status !== "ended").length ? (
        <ul className="space-y-3">
          {games
            .filter((g) => g.status !== "ended")
            .map((g) => (
              <li key={g.id}>
                <Link href={`/chapter/quiz/${g.id}`} className="block rounded-3xl bg-fg p-6 text-bg">
                  <p className="eyebrow !text-bg/70">{g.status === "lobby" ? "Starting soon" : "Live now"}</p>
                  <p className="mt-2 text-xl font-semibold">{mine.find((m) => m.chapter.id === g.chapterId)?.chapter.name} quiz</p>
                  <p className="mt-1 text-sm opacity-80">Tap to join</p>
                </Link>
              </li>
            ))}
        </ul>
      ) : (
        <p className="text-muted">No live games right now. When an officer starts quiz night, it shows up here.</p>
      )}
      {hostable.length ? (
        <>
          <SectionLabel>Host a game</SectionLabel>
          <HostForm chapters={hostable.map((m) => ({ id: m.chapter.id, name: m.chapter.name, org: m.chapter.org }))} clusters={clusters} />
        </>
      ) : null}
    </Page>
  );
}
