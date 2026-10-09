import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, gt } from "drizzle-orm";
import { ArrowRight, Gamepad2, Settings2, Users } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { roster } from "@/server/chapters";
import { Page, PageTitle, EmptyState } from "@/components/ui/page";
import { OrgBadge, Chip } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/card";
import { Notice } from "@/components/ui/form";
import type { OrgId } from "@/lib/orgs";
import { CheckInButton, LeaveButton } from "./client";

export const metadata: Metadata = { title: "Chapter" };

export default async function Chapter({ searchParams }: { searchParams: Promise<{ c?: string; joined?: string }> }) {
  const user = await requireUser();
  const { c, joined } = await searchParams;
  const mine = await db
    .select({ chapter: schema.chapters, role: schema.chapterMembers.role, points: schema.chapterMembers.points })
    .from(schema.chapterMembers)
    .innerJoin(schema.chapters, eq(schema.chapters.id, schema.chapterMembers.chapterId))
    .where(eq(schema.chapterMembers.userId, user.id))
    .orderBy(schema.chapters.org);
  if (!mine.length)
    return (
      <Page>
        <PageTitle title="Chapter" />
        <EmptyState
          icon={<Users />}
          title="No chapter yet"
          body="Join your school's chapter with the code from your advisor or a board member."
          action={
            <ButtonLink href="/join" block size="lg">
              <ArrowRight className="size-5" aria-hidden /> Enter a join code
            </ButtonLink>
          }
        />
        <p className="mt-6 text-center text-sm text-muted">
          Are you an advisor?{" "}
          <Link href="/chapter/new" className="font-medium text-fg underline underline-offset-2">
            Start a chapter for your school
          </Link>
        </p>
      </Page>
    );
  const current = mine.find((m) => m.chapter.id === c) ?? mine[0];
  const ch = current.chapter;
  const lead = current.role !== "member";
  const [open] = await db
    .select()
    .from(schema.checkins)
    .where(and(eq(schema.checkins.chapterId, ch.id), gt(schema.checkins.closesAt, new Date())))
    .orderBy(desc(schema.checkins.opensAt))
    .limit(1);
  const [mineCk] = open ? await db.select().from(schema.checkinRecords).where(and(eq(schema.checkinRecords.checkinId, open.id), eq(schema.checkinRecords.userId, user.id))) : [];
  const news = await db.select().from(schema.chapterAnnouncements).where(eq(schema.chapterAnnouncements.chapterId, ch.id)).orderBy(desc(schema.chapterAnnouncements.createdAt)).limit(10);
  const r = await roster(user.id, ch.id);
  const board = [...r.members].sort((a, b) => b.points - a.points).slice(0, 10);
  const [live] = await db
    .select({ id: schema.quizGames.id, status: schema.quizGames.status })
    .from(schema.quizGames)
    .where(and(eq(schema.quizGames.chapterId, ch.id), gt(schema.quizGames.createdAt, new Date(Date.now() - 6 * 3600_000))))
    .orderBy(desc(schema.quizGames.createdAt))
    .limit(1);

  return (
    <Page>
      <PageTitle
        title="Chapter"
        right={
          lead ? (
            <Link href={`/chapter/${ch.id}/manage`} className="inline-flex items-center gap-2 rounded-full bg-subtle px-4 py-2 text-sm font-medium hover:bg-subtle-2">
              <Settings2 className="size-4" aria-hidden /> Manage
            </Link>
          ) : null
        }
      />
      {joined ? <Notice tone="success" className="mb-4">You joined {ch.name}. Welcome!</Notice> : null}
      {mine.length > 1 ? (
        <nav aria-label="Your chapters" className="mb-4 flex gap-2">
          {mine.map((m) => (
            <Link key={m.chapter.id} href={`/chapter?c=${m.chapter.id}`} aria-current={m.chapter.id === ch.id} className={`rounded-full px-4 py-2 text-sm font-medium ${m.chapter.id === ch.id ? "bg-fg text-bg" : "bg-subtle"}`}>
              {m.chapter.org.toUpperCase()}
            </Link>
          ))}
          {mine.length < 4 ? (
            <Link href="/join" className="rounded-full border border-border px-4 py-2 text-sm font-medium">
              + Join another
            </Link>
          ) : null}
        </nav>
      ) : null}
      <section className="rounded-3xl bg-subtle p-6">
        <div className="flex flex-wrap items-center gap-2">
          <OrgBadge org={ch.org as OrgId} />
          <Chip>{current.role === "advisor" ? "Advisor" : current.role === "officer" ? "Board member" : "Member"}</Chip>
          {ch.verifiedAt ? <Chip>Verified chapter</Chip> : null}
          {ch.coversPro ? <Chip>Pro covered by chapter</Chip> : null}
        </div>
        <h2 className="mt-4 text-2xl font-semibold">{ch.name}</h2>
        <p className="text-muted">{ch.school}</p>
        <p className="mt-3 text-sm">
          <span className="font-semibold tabular">{current.points}</span> chapter points · {r.members.length} member{r.members.length === 1 ? "" : "s"}
        </p>
      </section>

      {open ? (
        <section className="mt-4 rounded-3xl bg-fg p-6 text-bg">
          <p className="eyebrow !text-bg/70">Check-in is open</p>
          <p className="mt-2 text-xl font-semibold">{open.title}</p>
          <p className="text-sm opacity-80">
            +{open.points} points · closes {open.closesAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </p>
          <div className="mt-4">{mineCk ? <p className="font-semibold">✓ You&apos;re checked in</p> : <CheckInButton id={open.id} />}</div>
        </section>
      ) : null}

      <div className="mt-4">
        <Link href="/chapter/quiz" className="flex items-center gap-4 rounded-3xl border border-border p-5 hover:bg-subtle/60">
          <span className="inline-flex size-11 items-center justify-center rounded-xl bg-subtle" aria-hidden>
            <Gamepad2 className="size-5" />
          </span>
          <span className="flex-1">
            <span className="block font-semibold">Quiz night</span>
            <span className="text-sm text-muted">{live && live.status !== "ended" ? "A game is live now. Join in!" : lead ? "Host a live quiz for your chapter" : "Join your chapter's live game"}</span>
          </span>
          <ArrowRight className="size-5" aria-hidden />
        </Link>
      </div>

      <SectionLabel>Announcements</SectionLabel>
      {news.length ? (
        <ul className="space-y-3">
          {news.map((a) => (
            <li key={a.id} className="rounded-3xl border border-border p-5">
              <p className="font-semibold">{a.title}</p>
              <p className="mt-1 whitespace-pre-wrap text-muted">{a.body}</p>
              <p className="mt-2 text-xs text-muted">{a.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">No announcements yet.</p>
      )}

      <SectionLabel>Leaderboard</SectionLabel>
      <ol className="divide-y divide-border rounded-3xl border border-border px-5">
        {board.map((m, i) => (
          <li key={m.userId} className="flex items-center gap-4 py-3">
            <span className="w-6 text-sm font-semibold text-muted tabular">{i + 1}</span>
            <span className="flex-1">{m.userId === user.id ? `${m.name} (you)` : m.name}</span>
            <span className="font-semibold tabular">{m.points}</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-muted">Points come from meeting check-ins and quiz nights.</p>

      <SectionLabel>Members</SectionLabel>
      <ul className="divide-y divide-border rounded-3xl border border-border px-5">
        {r.members.map((m) => (
          <li key={m.userId} className="flex items-center justify-between gap-3 py-3">
            <span>{m.name}</span>
            {m.role !== "member" ? <Chip>{m.role === "advisor" ? "Advisor" : "Board"}</Chip> : null}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">Members see display names only. Advisors and board members can see study activity only for members who allow it in Profile.</p>

      <div className="mt-8">
        <LeaveButton chapterId={ch.id} name={ch.name} />
      </div>
    </Page>
  );
}
