import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { activeSelection } from "@/server/progress";
import { BackHeader, Page } from "@/components/ui/page";
import { Card, HeroTexture, SectionLabel } from "@/components/ui/card";
import { EventFacts, EventSummary } from "@/components/app/event-details";
import { OrgScope } from "@/components/app/org-theme";
import type { OrgId } from "@/lib/orgs";
import { SelectEventButton } from "./select-button";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const [e] = await db.select({ name: schema.events.name }).from(schema.events).where(eq(schema.events.id, id));
  return { title: e?.name ?? "Event" };
}

export default async function EventDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [event] = await db.select().from(schema.events).where(eq(schema.events.id, id));
  if (!event) notFound();
  const current = await activeSelection(user.id, event.org);
  const isCurrent = current?.event.id === event.id;
  return (
    <OrgScope org={event.org as OrgId}>
      <Page>
        <BackHeader href={`/study/events?federation=${event.org}`} title="Event details" />
        <EventSummary event={event} />
        <Card tone="inverse" className="mt-3 shadow-float">
          <HeroTexture />
          <div className="relative">
            <p className="eyebrow !text-hero-muted">{isCurrent ? "Your event" : current ? "Switch events" : "Make it yours"}</p>
            <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-hero-muted">
              {isCurrent ? (
                "Your countdown, study plan and practice tools are set up for this event."
              ) : current ? (
                <>
                  You&apos;re currently studying <strong className="font-semibold text-hero-fg">{current.event.name}</strong>. Switching keeps your history; practice and feedback stay tied to the event
                  they were for.
                </>
              ) : (
                "Get a countdown, a smart study plan and practice tools built around this event."
              )}
            </p>
            <div className="mt-6">
              <SelectEventButton eventId={event.id} isCurrent={isCurrent} />
            </div>
          </div>
        </Card>
        <SectionLabel>About this event</SectionLabel>
        <EventFacts event={event} />
      </Page>
    </OrgScope>
  );
}
