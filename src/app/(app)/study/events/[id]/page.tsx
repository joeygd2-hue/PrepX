import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { activeSelection } from "@/server/progress";
import { BackHeader, Page } from "@/components/ui/page";
import { EventFacts, EventSummary } from "@/components/app/event-details";
import { Notice } from "@/components/ui/form";
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
    <Page>
      <BackHeader href={`/study/events?federation=${event.org}`} title="Event details" />
      <EventSummary event={event} />
      <div className="mt-4">
        <EventFacts event={event} />
      </div>
      <div className="mt-6 space-y-3">
        {current && !isCurrent ? (
          <Notice>
            You&apos;re currently studying <strong>{current.event.name}</strong>. Switching keeps your history; practice and feedback stay tied to the event they were for.
          </Notice>
        ) : null}
        <SelectEventButton eventId={event.id} isCurrent={isCurrent} />
      </div>
    </Page>
  );
}
