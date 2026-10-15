import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import { db, schema } from "@/db";
import { PublicPage } from "@/components/shell/public-page";
import { EventFacts, EventSummary } from "@/components/app/event-details";
import { BackHeader } from "@/components/ui/page";
import { Card, HeroTexture, SectionLabel } from "@/components/ui/card";
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
      <BackHeader href={`/events?org=${event.org}`} title="Event details" />
      <EventSummary event={event} />
      <Card tone="inverse" className="mt-3 shadow-float">
        <HeroTexture />
        <div className="relative">
          <p className="eyebrow !text-hero-muted">Make it yours</p>
          <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-hero-muted">Get a countdown, a smart study plan and practice tools built around this event.</p>
          <ButtonLink href={`/study/events/${event.id}`} variant="accent" className="mt-6">
            Prepare for this event <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-0.5" aria-hidden />
          </ButtonLink>
        </div>
      </Card>
      <SectionLabel>About this event</SectionLabel>
      <EventFacts event={event} />
    </PublicPage>
  );
}
