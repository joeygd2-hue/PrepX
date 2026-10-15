import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { membership, roster } from "@/server/chapters";
import { BackHeader, Page } from "@/components/ui/page";
import { SectionLabel } from "@/components/ui/card";
import { Notice } from "@/components/ui/form";
import { CodePanel, AnnounceForm, CheckinForm, MemberRow, CloseCheckin } from "./client";

export const metadata: Metadata = { title: "Manage chapter" };

export default async function Manage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { created } = await searchParams;
  const m = await membership(user.id, id);
  if (!m) notFound();
  if (m.role === "member") redirect("/chapter");
  const [c] = await db.select().from(schema.chapters).where(eq(schema.chapters.id, id));
  const r = await roster(user.id, id);
  const checkins = await db.select().from(schema.checkins).where(and(eq(schema.checkins.chapterId, id))).orderBy(desc(schema.checkins.opensAt)).limit(5);
  const isAdvisor = m.role === "advisor";
  const now = new Date();
  return (
    <Page>
      <BackHeader href={`/chapter?c=${id}`} title="Manage chapter" subtitle={c.name} />
      {created ? <Notice tone="success" className="mb-4">Chapter created. Share the join code below with your members.</Notice> : null}
      <CodePanel chapterId={id} code={c.joinCode} expiresAt={c.joinCodeExpiresAt?.toISOString() ?? null} enabled={c.joinEnabled} canEdit={isAdvisor} />

      <SectionLabel>Post an announcement</SectionLabel>
      <AnnounceForm chapterId={id} />

      <SectionLabel>Meeting check-in</SectionLabel>
      <CheckinForm chapterId={id} />
      {checkins.length ? (
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-[24px] border border-border bg-card px-4 shadow-card sm:px-5">
          {checkins.map((ck) => {
            const open = ck.closesAt > now;
            return (
              <li key={ck.id} className="flex items-center justify-between gap-3 py-3.5">
                <span className="min-w-0">
                  <span className="flex items-center gap-2 font-medium tracking-[-0.01em]">
                    {open ? <span aria-hidden className="size-2 shrink-0 rounded-full bg-accent shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--fg)_25%,transparent)]" /> : null}
                    <span className="truncate">{ck.title}</span>
                  </span>
                  <span className="mt-0.5 block font-mono text-xs text-muted tabular">
                    +{ck.points} pts · {ck.opensAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </span>
                {open ? <CloseCheckin id={ck.id} /> : <span className="shrink-0 text-sm text-muted">Closed</span>}
              </li>
            );
          })}
        </ul>
      ) : null}

      <SectionLabel>Members ({r.members.length})</SectionLabel>
      <ul className="divide-y divide-border overflow-hidden rounded-[24px] border border-border bg-card px-4 shadow-card sm:px-5">
        {r.members.map((mm) => (
          <MemberRow
            key={mm.userId}
            chapterId={id}
            member={mm}
            isSelf={mm.userId === user.id}
            canChangeRole={isAdvisor}
            canRemove={mm.userId !== user.id && (isAdvisor || mm.role === "member")}
          />
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">Study activity is shown only for members who allow it. PrepX never shows members&apos; email addresses, birthdays or other private details.</p>
    </Page>
  );
}
