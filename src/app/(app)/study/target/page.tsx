import type { Metadata } from "next";
import { and, asc, eq, gte } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { activeSelection } from "@/server/progress";
import { todayIn, formatRange } from "@/lib/dates";
import { BackHeader, Page } from "@/components/ui/page";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/form";
import { TargetForm } from "./form";

export const metadata: Metadata = { title: "Competition date" };

export default async function Target() {
  const user = await requireUser();
  const sel = await activeSelection(user.id);
  if (!sel)
    return (
      <Page>
        <BackHeader href="/study" title="Competition date" />
        <Notice>Choose your event first.</Notice>
        <ButtonLink href="/study/events" variant="outline" className="mt-4">
          Browse events <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-0.5" aria-hidden />
        </ButtonLink>
      </Page>
    );
  const comps = await db
    .select()
    .from(schema.competitions)
    .where(and(eq(schema.competitions.org, sel.sel.org), gte(schema.competitions.endsOn, todayIn(user.profile!.timezone))))
    .orderBy(asc(schema.competitions.startsOn));
  return (
    <Page>
      <BackHeader href="/study" title="Competition date" subtitle={`${sel.event.code} · ${sel.event.name}`} />
      <p className="mb-6 max-w-lg text-muted">Your countdown and study plan count down to this date. Official dates update automatically if they change.</p>
      <TargetForm
        org={sel.sel.org}
        current={sel.sel.targetDate ? "custom" : sel.sel.competitionId ?? "auto"}
        currentDate={sel.sel.targetDate}
        competitions={comps.map((c) => ({ id: c.id, label: c.name, detail: `${formatRange(c.startsOn, c.endsOn)}${c.location ? ` · ${c.location}` : ""}`, status: c.status }))}
      />
    </Page>
  );
}
