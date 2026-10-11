import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { activeSelection } from "@/server/progress";
import { getAllowance } from "@/server/entitlements";
import { features } from "@/lib/env";
import { formatDay, todayIn } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { BackHeader, Page } from "@/components/ui/page";
import { SectionLabel } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/form";
import { CoachChat } from "./chat";
import { debriefContext } from "@/app/actions/ai";

export const metadata: Metadata = { title: "AI coach" };

export default async function Coach({ searchParams }: { searchParams: Promise<{ s?: string; prompt?: string }> }) {
  const user = await requireUser();
  const { s, prompt } = await searchParams;
  const tz = user.profile!.timezone;
  const sel = await activeSelection(user.id);
  const sessions = await db
    .select({ id: schema.aiSessions.id, title: schema.aiSessions.title, updatedAt: schema.aiSessions.updatedAt })
    .from(schema.aiSessions)
    .where(and(eq(schema.aiSessions.userId, user.id), eq(schema.aiSessions.kind, "coach")))
    .orderBy(desc(schema.aiSessions.updatedAt))
    .limit(15);
  const current = s ? sessions.find((x) => x.id === s) : undefined;
  const messages = current
    ? await db.select({ role: schema.aiMessages.role, content: schema.aiMessages.content }).from(schema.aiMessages).where(eq(schema.aiMessages.sessionId, current.id)).orderBy(asc(schema.aiMessages.createdAt))
    : [];
  const allowance = await getAllowance(user.id, "coach_message", tz);
  const initial = prompt === "debrief" ? await debriefContext() : "";
  return (
    <Page>
      <BackHeader href="/study" title="AI coach" subtitle={sel ? `${sel.event.code} · ${sel.event.name}` : "General competition prep"} />
      {!features.ai() ? <Notice tone="warning" className="mb-4">AI coaching isn&apos;t configured on this server yet.</Notice> : null}
      {features.aiIsMock() ? <Notice className="mb-4">Development mode: replies come from a test provider, not a real AI.</Notice> : null}
      <CoachChat
        sessionId={current?.id ?? null}
        initialMessages={messages as { role: "user" | "assistant"; content: string }[]}
        remaining={allowance.unlimited ? null : allowance.remaining}
        resets={allowance.resets}
        initialDraft={initial}
        suggestions={
          sel
            ? [`What do judges look for in ${sel.event.code}?`, "Quiz me on one concept I should know", "How do I open a role-play strongly?", "Help me make a study plan for this week"]
            : ["Which event fits someone who likes public speaking?", "How do competitive events work?"]
        }
      />
      {sessions.length ? (
        <section className="mt-10">
          <div className="mb-3 flex items-center gap-3">
            <SectionLabel className="my-0 min-w-0 flex-1">Recent conversations</SectionLabel>
            <ButtonLink href="/study/coach" variant="outline" size="sm" className="shrink-0">
              <Plus className="size-4" aria-hidden />
              New chat
            </ButtonLink>
          </div>
          <ul className="divide-y divide-border overflow-hidden rounded-[24px] border border-border bg-card px-4 shadow-card sm:px-5">
            {sessions.map((x) => {
              const active = x.id === current?.id;
              return (
                <li key={x.id}>
                  <Link
                    href={`/study/coach?s=${x.id}`}
                    aria-current={active}
                    className={cn("-mx-4 flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-subtle/60 sm:-mx-5 sm:px-5", active && "bg-subtle/60")}
                  >
                    <span
                      aria-hidden
                      className={cn("size-1.5 shrink-0 rounded-full", active ? "bg-accent shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_25%,transparent)]" : "bg-border-strong")}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium tracking-[-0.01em]">{x.title || "Conversation"}</span>
                    <span className="shrink-0 font-mono text-xs text-muted tabular">{formatDay(todayIn(tz, x.updatedAt), { month: "short", day: "numeric" })}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-muted">Conversations are kept for 180 days so you can review them, then deleted automatically. You can delete them anytime.</p>
        </section>
      ) : null}
    </Page>
  );
}
