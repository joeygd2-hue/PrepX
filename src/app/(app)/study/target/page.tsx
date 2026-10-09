import type { Metadata } from "next";
import { and, asc, eq, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { activeSelection } from "@/server/progress";
import { todayIn, formatRange } from "@/lib/dates";
import { BackHeader, Page } from "@/components/ui/page";
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
      <p className="mb-5 text-muted">Your countdown and study plan count down to this date. Official dates update automatically if they change.</p>
      <TargetForm
        org={sel.sel.org}
        current={sel.sel.targetDate ? "custom" : sel.sel.competitionId ?? "auto"}
        currentDate={sel.sel.targetDate}
        competitions={comps.map((c) => ({ id: c.id, label: `${c.name} · ${formatRange(c.startsOn, c.endsOn)}${c.location ? ` · ${c.location}` : ""}`, status: c.status }))}
      />
    </Page>
  );
}
