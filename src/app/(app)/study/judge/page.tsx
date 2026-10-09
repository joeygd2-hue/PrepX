import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { activeSelection } from "@/server/progress";
import { getAllowance } from "@/server/entitlements";
import { features } from "@/lib/env";
import { BackHeader, Page } from "@/components/ui/page";
import { Notice } from "@/components/ui/form";
import { ButtonLink } from "@/components/ui/button";
import { StartJudge } from "./start";

export const metadata: Metadata = { title: "AI judge" };

export default async function JudgeStart({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const user = await requireUser();
  const { mode } = await searchParams;
  const face = mode === "face";
  const sel = await activeSelection(user.id);
  if (!sel)
    return (
      <Page>
        <BackHeader href="/study" title="AI judge" />
        <Notice>Choose your event first so the judge knows what to evaluate.</Notice>
        <ButtonLink href="/study/events" className="mt-4">
          Choose event
        </ButtonLink>
      </Page>
    );
  const allowance = await getAllowance(user.id, "judge_run", user.profile!.timezone);
  const runs = await db
    .select({ id: schema.aiSessions.id, title: schema.aiSessions.title, status: schema.aiSessions.status, createdAt: schema.aiSessions.createdAt })
    .from(schema.aiSessions)
    .where(and(eq(schema.aiSessions.userId, user.id), inArray(schema.aiSessions.kind, ["judge", "face_to_face"])))
    .orderBy(desc(schema.aiSessions.createdAt))
    .limit(10);
  const c = sel.event.components;
  const scenarioBased = Boolean(c.roleplay || c.caseStudy);
  return (
    <Page>
      <BackHeader href="/study" title={face ? "Face-to-face judge" : scenarioBased ? "Role-play judge" : "Presentation judge"} subtitle={`${sel.event.code} · ${sel.event.name}`} />
      <section className="rounded-3xl border border-border p-6">
        <h2 className="text-xl font-semibold">How it works</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-muted">
          {scenarioBased ? <li>Get an original practice scenario with performance indicators.</li> : <li>Get a practice prompt for your presentation or interview.</li>}
          {c.roleplay?.prepMinutes || c.caseStudy?.prepMinutes ? <li>Prep with a timer, just like competition.</li> : null}
          <li>Present out loud with your microphone, or type your response.</li>
          {face ? <li>Optionally share up to 3 camera stills for body-language feedback. Video is never recorded.</li> : null}
          <li>Get a simulated practice score with a breakdown and next steps.</li>
        </ol>
      </section>
      {!features.ai() ? <Notice tone="warning" className="mt-4">The AI judge isn&apos;t configured on this server yet.</Notice> : null}
      <div className="mt-6">
        <StartJudge mode={face ? "face" : "standard"} remaining={allowance.unlimited ? null : allowance.remaining} resets={allowance.resets} disabled={!features.ai()} />
      </div>
      {runs.length ? (
        <section className="mt-10">
          <h2 className="eyebrow mb-3">Your runs</h2>
          <ul className="divide-y divide-border rounded-3xl border border-border px-5">
            {runs.map((r) => (
              <li key={r.id}>
                <Link href={`/study/judge/${r.id}`} className="-mx-5 flex justify-between gap-3 px-5 py-3 hover:bg-subtle/60">
                  <span className="truncate">{r.title}</span>
                  <span className="shrink-0 text-sm text-muted">{r.status === "scored" ? "Scored" : "Not finished"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Page>
  );
}
