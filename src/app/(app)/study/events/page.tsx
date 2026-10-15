import type { Metadata } from "next";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { activeSelection } from "@/server/progress";
import { isOrg, ORGS, ORG_IDS, type OrgId } from "@/lib/orgs";
import { cn } from "@/lib/cn";
import { Accent, Page, PageTitle } from "@/components/ui/page";
import { OrgScope } from "@/components/app/org-theme";
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
    <OrgScope org={org}>
      <Page>
        <PageTitle
          eyebrow="Study"
          title={
            <>
              Choose your <Accent>event</Accent>
            </>
          }
          subtitle={
            <>
              {ORGS[org].name} {season} high school events. You can change this anytime.
            </>
          }
        />
        <nav aria-label="Organization" className="grid grid-cols-4 gap-1 rounded-[16px] border border-border bg-subtle/80 p-1">
          {ORG_IDS.map((o) => (
            <a
              key={o}
              href={`/study/events?federation=${o}`}
              aria-current={o === org ? "page" : undefined}
              className={cn(
                "flex h-10 items-center justify-center gap-2 rounded-[12px] font-mono text-xs font-semibold tracking-wider transition-colors",
                o === org ? "bg-card text-fg shadow-card" : "text-muted hover:text-fg",
              )}
            >
              <span className="size-1.5 rounded-full" style={{ background: `var(--${o})` }} aria-hidden />
              {ORGS[o].name}
            </a>
          ))}
        </nav>
        <EventChooser org={org} events={events} selectedId={sel?.event.id ?? null} placeholder={ORGS[org].searchHint} />
      </Page>
    </OrgScope>
  );
}
