import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { ArrowRight, Gamepad2 } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { BackHeader, Page, EmptyState } from "@/components/ui/page";
import { ButtonLink } from "@/components/ui/button";
import { Card, HeroTexture, IconTile, SectionLabel } from "@/components/ui/card";
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
        <EmptyState icon={<Gamepad2 />} title="Join a chapter to play" body="Quiz night is a live game your chapter's officers host at meetings." action={<ButtonLink href="/join" variant="accent">Enter a join code</ButtonLink>} />
      </Page>
    );
  const games = await db
    .select()
    .from(schema.quizGames)
    .where(and(inArray(schema.quizGames.chapterId, mine.map((m) => m.chapter.id)), gt(schema.quizGames.createdAt, new Date(Date.now() - 12 * 3600_000))))
    .orderBy(desc(schema.quizGames.createdAt));
  const hostable = mine.filter((m) => m.role !== "member");
  // Only question sets for the hosts' own organizations; cross-organization sets (no org) aren't offered.
  const clusters = hostable.length
    ? await db
        .select({ id: schema.examClusters.id, name: schema.examClusters.name, org: schema.examClusters.org, n: sql<number>`count(${schema.questions.id})::int` })
        .from(schema.examClusters)
        .innerJoin(schema.questions, eq(schema.questions.clusterId, schema.examClusters.id))
        .where(inArray(schema.examClusters.org, [...new Set(hostable.map((m) => m.chapter.org))]))
        .groupBy(schema.examClusters.id)
    : [];
  const liveGames = games.filter((g) => g.status !== "ended");
  return (
    <Page>
      <BackHeader href="/chapter" title="Quiz night" />
      {liveGames.length ? (
        <ul className="stagger space-y-3">
          {liveGames.map((g) => (
            <li key={g.id}>
              <Link href={`/chapter/quiz/${g.id}`} className="group/game relative block overflow-hidden rounded-[28px] bg-hero p-6 text-hero-fg shadow-float transition-transform duration-300 hover:-translate-y-0.5 sm:p-8">
                <HeroTexture />
                <span className="relative block">
                  <span className="eyebrow flex items-center gap-2 !text-hero-muted">
                    <span aria-hidden className="relative inline-flex size-2">
                      <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-60" />
                      <span className="relative size-2 rounded-full bg-accent" />
                    </span>
                    {g.status === "lobby" ? "Starting soon" : "Live now"}
                  </span>
                  <span className="mt-6 block text-[1.75rem] font-semibold leading-[1.1] tracking-[-0.03em] [overflow-wrap:anywhere]">
                    {mine.find((m) => m.chapter.id === g.chapterId)?.chapter.name} quiz
                  </span>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-hero-muted transition-colors group-hover/game:text-hero-fg">
                    Tap to join <ArrowRight className="size-4 transition-transform group-hover/game:translate-x-0.5" aria-hidden />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Card tone="subtle" className="flex items-start gap-4">
          <IconTile inverse>
            <Gamepad2 />
          </IconTile>
          <p className="text-muted">No live games right now. When an officer starts quiz night, it shows up here.</p>
        </Card>
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
