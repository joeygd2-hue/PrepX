import type { Metadata } from "next";
import { and, eq, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { streakSummary } from "@/server/progress";
import { BackHeader, Page } from "@/components/ui/page";
import { SectionLabel } from "@/components/ui/card";
import { AddBuddy, BuddyActions } from "./client";

export const metadata: Metadata = { title: "Study buddies" };

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
  return (
    <Page>
      <BackHeader href="/" title="Study buddies" />
      <p className="text-muted">See each other&apos;s streaks and send a friendly nudge. Buddies only see your display name and streak.</p>
      <section className="mt-5 rounded-3xl bg-subtle p-5">
        <p className="text-sm text-muted">Your friend code</p>
        <p className="mt-1 text-3xl font-semibold tracking-widest">{user.profile!.referralCode}</p>
      </section>
      <AddBuddy />
      {enriched.some((b) => b.status === "pending" && b.incoming) ? (
        <>
          <SectionLabel>Requests</SectionLabel>
          <ul className="divide-y divide-border rounded-3xl border border-border px-5">
            {enriched.filter((b) => b.status === "pending" && b.incoming).map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 py-3">
                <span>{b.name}</span>
                <BuddyActions id={b.id} mode="request" />
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <SectionLabel>Buddies</SectionLabel>
      {enriched.filter((b) => b.status === "accepted").length ? (
        <ul className="divide-y divide-border rounded-3xl border border-border px-5">
          {enriched.filter((b) => b.status === "accepted").map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 py-4">
              <span>
                <span className="block font-medium">{b.name}</span>
                <span className="text-sm text-muted">
                  🔥 {b.streak}-day streak · {b.today ? "practiced today" : "hasn't practiced today"}
                </span>
              </span>
              <BuddyActions id={b.id} mode="buddy" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">No buddies yet. Share your friend code with a teammate.</p>
      )}
      {enriched.some((b) => b.status === "pending" && !b.incoming) ? <p className="mt-3 text-sm text-muted">{enriched.filter((b) => b.status === "pending" && !b.incoming).length} request(s) waiting for a reply.</p> : null}
    </Page>
  );
}
