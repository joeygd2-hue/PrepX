import type { Metadata } from "next";
import { eq, or } from "drizzle-orm";
import { Flame } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { streakSummary } from "@/server/progress";
import { cn } from "@/lib/cn";
import { BackHeader, Page } from "@/components/ui/page";
import { Card, HeroTexture, SectionLabel } from "@/components/ui/card";
import { Avatar, initials } from "@/components/app/avatar";
import { AddBuddy, BuddyActions } from "./client";

export const metadata: Metadata = { title: "Study buddies" };

const list = "divide-y divide-border overflow-hidden rounded-[24px] border border-border bg-card px-4 shadow-card sm:px-5";

export default async function Buddies() {
  const user = await requireUser();
  const rows = await db.select().from(schema.buddies).where(or(eq(schema.buddies.requesterId, user.id), eq(schema.buddies.addresseeId, user.id)));
  const otherIds = rows.map((b) => (b.requesterId === user.id ? b.addresseeId : b.requesterId));
  const profiles = otherIds.length ? await db.select({ userId: schema.profiles.userId, name: schema.profiles.displayName, tz: schema.profiles.timezone }).from(schema.profiles).where(or(...otherIds.map((id) => eq(schema.profiles.userId, id)))) : [];
  const enriched = await Promise.all(
    rows.map(async (b) => {
      const otherId = b.requesterId === user.id ? b.addresseeId : b.requesterId;
      const p = profiles.find((x) => x.userId === otherId);
      const s = b.status === "accepted" && p ? await streakSummary(otherId, p.tz) : null;
      return { id: b.id, name: p?.name ?? "Buddy", status: b.status, incoming: b.addresseeId === user.id, streak: s?.current ?? null, today: s?.practicedToday ?? null };
    }),
  );
  const requests = enriched.filter((b) => b.status === "pending" && b.incoming);
  const accepted = enriched.filter((b) => b.status === "accepted");
  const waiting = enriched.filter((b) => b.status === "pending" && !b.incoming).length;
  return (
    <Page>
      <BackHeader href="/" title="Study buddies" />
      <p className="max-w-lg px-1 text-muted">See each other&apos;s streaks and send a friendly nudge. Buddies only see your display name and streak.</p>
      <Card tone="inverse" className="mt-5 shadow-float">
        <HeroTexture />
        <div className="relative">
          <p className="eyebrow !text-hero-muted">Your friend code</p>
          <p className="mt-4 break-all font-mono text-[2.5rem] font-medium leading-none tracking-[0.12em] tabular sm:text-5xl">{user.profile!.referralCode}</p>
        </div>
      </Card>
      <Card className="mt-3">
        <AddBuddy />
      </Card>
      {requests.length ? (
        <>
          <SectionLabel>Requests</SectionLabel>
          <ul className={list}>
            {requests.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 py-3.5">
                <Avatar text={initials(b.name)} size="sm" />
                <span className="min-w-0 flex-1 font-medium tracking-[-0.01em]">{b.name}</span>
                <BuddyActions id={b.id} mode="request" />
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <SectionLabel>Buddies</SectionLabel>
      {accepted.length ? (
        <ul className={list}>
          {accepted.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-3 py-3.5">
              <Avatar text={initials(b.name)} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium tracking-[-0.01em]">{b.name}</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
                  <Flame className={cn("size-3.5 shrink-0", b.today ? "text-fg" : "text-muted")} aria-hidden />
                  <span>
                    <span className="font-mono tabular">{b.streak}</span>-day streak · {b.today ? "practiced today" : "hasn't practiced today"}
                  </span>
                </span>
              </span>
              <BuddyActions id={b.id} mode="buddy" />
            </li>
          ))}
        </ul>
      ) : (
        <Card tone="subtle" className="text-muted">
          No buddies yet. Share your friend code with a teammate.
        </Card>
      )}
      {waiting ? <p className="mt-3 px-1 text-sm text-muted">{waiting} request(s) waiting for a reply.</p> : null}
    </Page>
  );
}
