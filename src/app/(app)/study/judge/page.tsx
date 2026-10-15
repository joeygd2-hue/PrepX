import type { Metadata } from "next";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { activeSelection } from "@/server/progress";
import { getAllowance } from "@/server/entitlements";
import { JUDGE_KINDS } from "@/server/ai/sessions";
import { features } from "@/lib/env";
import { formatDay, todayIn } from "@/lib/dates";
import type { OrgId } from "@/lib/orgs";
import { BackHeader, Page } from "@/components/ui/page";
import { Card, HeroTexture, SectionLabel } from "@/components/ui/card";
import { Chip, OrgBadge } from "@/components/ui/badge";
import { ListGroup, ListRow } from "@/components/ui/list";
import { Notice } from "@/components/ui/form";
import { ButtonLink } from "@/components/ui/button";
import { StartJudge } from "./start";

export const metadata: Metadata = { title: "AI judge" };

export default async function JudgeStart({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const user = await requireUser();
  const { mode } = await searchParams;
  const face = mode === "face";
  const tz = user.profile!.timezone;
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
  const allowance = await getAllowance(user.id, "judge_run", tz);
  const runs = await db
    .select({ id: schema.aiSessions.id, title: schema.aiSessions.title, status: schema.aiSessions.status, createdAt: schema.aiSessions.createdAt })
    .from(schema.aiSessions)
    .where(and(eq(schema.aiSessions.userId, user.id), inArray(schema.aiSessions.kind, JUDGE_KINDS)))
    .orderBy(desc(schema.aiSessions.createdAt))
    .limit(10);
  const c = sel.event.components;
  const scenarioBased = Boolean(c.roleplay || c.caseStudy);
  const steps = [
    scenarioBased ? "Get an original practice scenario with performance indicators." : "Get a practice prompt for your presentation or interview.",
    c.roleplay?.prepMinutes || c.caseStudy?.prepMinutes ? "Prep with a timer, just like competition." : null,
    "Present out loud with your microphone, or type your response.",
    face ? "Optionally share up to 3 camera stills for body-language feedback. Video is never recorded." : null,
    "Get a simulated practice score with a breakdown and next steps.",
  ].filter((x): x is string => Boolean(x));
  return (
    <Page>
      <BackHeader href="/study" title={face ? "Face-to-face judge" : scenarioBased ? "Role-play judge" : "Presentation judge"} subtitle={`${sel.event.code} · ${sel.event.name}`} />
      <Card tone="inverse" className="rounded-[28px] p-6 shadow-float sm:p-8">
        <HeroTexture />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <OrgBadge org={sel.event.org as OrgId} onHero />
            <Chip tone="inverse" className="font-mono tracking-wider">
              {sel.event.code}
            </Chip>
          </div>
          <h2 className="mt-7 text-[1.75rem] font-semibold leading-[1.1] tracking-[-0.03em]">How it works</h2>
          <ol className="mt-5 divide-y divide-hero-line border-y border-hero-line">
            {steps.map((step, i) => (
              <li key={step} className="flex gap-4 py-3.5 text-[15px] leading-relaxed">
                <span aria-hidden className="mt-0.5 font-mono text-xs text-hero-muted tabular">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-7">
            <StartJudge mode={face ? "face" : "standard"} remaining={allowance.unlimited ? null : allowance.remaining} resets={allowance.resets} disabled={!features.ai()} />
          </div>
        </div>
      </Card>
      {!features.ai() ? <Notice tone="warning" className="mt-4">The AI judge isn&apos;t configured on this server yet.</Notice> : null}
      {runs.length ? (
        <section>
          <SectionLabel>Your runs</SectionLabel>
          <ListGroup>
            {runs.map((r) => (
              <ListRow
                key={r.id}
                href={`/study/judge/${r.id}`}
                title={r.title}
                subtitle={<span className="font-mono text-xs tabular">{formatDay(todayIn(tz, r.createdAt), { month: "short", day: "numeric" })}</span>}
                right={r.status === "scored" ? <Chip className="shrink-0">Scored</Chip> : <span className="shrink-0 text-sm text-muted">Not finished</span>}
              />
            ))}
          </ListGroup>
        </section>
      ) : null}
    </Page>
  );
}
