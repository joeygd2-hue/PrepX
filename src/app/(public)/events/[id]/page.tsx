import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { PublicPage } from "@/components/shell/public-page";
import { EventFacts, EventSummary } from "@/components/app/event-details";
import { ButtonLink } from "@/components/ui/button";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const [e] = await db.select({ name: schema.events.name }).from(schema.events).where(eq(schema.events.id, id));
  return { title: e?.name ?? "Event" };
}

export default async function PublicEvent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [event] = await db.select().from(schema.events).where(eq(schema.events.id, id));
  if (!event) notFound();
  return (
    <PublicPage>
      <EventSummary event={event} />
      <div className="mt-4">
        <EventFacts event={event} />
      </div>
      <ButtonLink href={`/study/events/${event.id}`} className="mt-6">
        Prepare for this event
      </ButtonLink>
    </PublicPage>
  );
}
