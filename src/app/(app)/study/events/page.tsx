import type { Metadata } from "next";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { activeSelection } from "@/server/progress";
import { isOrg, ORGS, ORG_IDS, type OrgId } from "@/lib/orgs";
import { Page } from "@/components/ui/page";
import { EventChooser } from "./chooser";

export const metadata: Metadata = { title: "Choose your event" };

export default async function ChooseEvent({ searchParams }: { searchParams: Promise<{ federation?: string }> }) {
  const user = await requireUser();
  const { federation } = await searchParams;
  const org: OrgId = isOrg(federation) ? federation : ((user.profile?.focusOrg ?? user.profile?.orgInterests[0] ?? "deca") as OrgId);
  const events = await db
    .select({ id: schema.events.id, code: schema.events.code, name: schema.events.name, category: schema.events.category, cluster: schema.events.cluster, formatLabel: schema.events.formatLabel })
    .from(schema.events)
    .where(and(eq(schema.events.org, org), eq(schema.events.active, true)))
    .orderBy(asc(schema.events.position));
  const sel = await activeSelection(user.id, org);
  const season = events.length ? "2026-2027" : "";
  return (
    <Page>
      <h1 className="text-[2rem] font-semibold leading-tight tracking-tight">Choose your event</h1>
      <p className="mt-2 text-muted">
        {ORGS[org].name} {season} high school events. You can change this anytime.
      </p>
      <nav aria-label="Organization" className="mt-5 flex gap-2 overflow-x-auto">
        {ORG_IDS.map((o) => (
          <a key={o} href={`/study/events?federation=${o}`} aria-current={o === org ? "page" : undefined} className={`rounded-full px-4 py-2 text-sm font-medium ${o === org ? "bg-fg text-bg" : "bg-subtle"}`}>
            {ORGS[o].name}
          </a>
        ))}
      </nav>
      <EventChooser org={org} events={events} selectedId={sel?.event.id ?? null} placeholder={ORGS[org].searchHint} />
    </Page>
  );
}
