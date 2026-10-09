import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { activeSelection } from "@/server/progress";
import { getAllowance } from "@/server/entitlements";
import { features } from "@/lib/env";
import { BackHeader, Page } from "@/components/ui/page";
import { Notice } from "@/components/ui/form";
import { CoachChat } from "./chat";
import { debriefContext } from "@/app/actions/ai";

export const metadata: Metadata = { title: "AI coach" };

export default async function Coach({ searchParams }: { searchParams: Promise<{ s?: string; prompt?: string }> }) {
  const user = await requireUser();
  const { s, prompt } = await searchParams;
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
  const allowance = await getAllowance(user.id, "coach_message", user.profile!.timezone);
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
          <div className="mb-3 flex items-center justify-between">
            <h2 className="eyebrow">Recent conversations</h2>
            <Link href="/study/coach" className="text-sm font-medium">
              New chat
            </Link>
          </div>
          <ul className="divide-y divide-border rounded-3xl border border-border px-5">
            {sessions.map((x) => (
              <li key={x.id}>
                <Link href={`/study/coach?s=${x.id}`} aria-current={x.id === current?.id} className="-mx-5 block truncate px-5 py-3 hover:bg-subtle/60">
                  {x.title || "Conversation"}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">Conversations are kept for 180 days so you can review them, then deleted automatically. You can delete them anytime.</p>
        </section>
      ) : null}
    </Page>
  );
}
