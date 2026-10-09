import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { VerificationChip } from "@/components/ui/badge";
import { isOrg, ORG_IDS } from "@/lib/orgs";

export const metadata = { title: "Events" };

export default async function Events({ searchParams }: { searchParams: Promise<{ org?: string; v?: string }> }) {
  const { org, v } = await searchParams;
  const rows = await db
    .select()
    .from(schema.events)
    .where(and(isOrg(org) ? eq(schema.events.org, org) : undefined, v === "unverified" ? eq(schema.events.verification, "unverified") : undefined))
    .orderBy(asc(schema.events.org), asc(schema.events.position));
  return (
    <div>
      <h1 className="text-3xl font-semibold">Event catalog</h1>
      <p className="mt-2 text-muted">Update formats only from official guidelines, then mark them verified with the source and date checked.</p>
      <nav className="mt-4 flex flex-wrap gap-2 text-sm">
        <Link href="/admin/events" className="rounded-full bg-subtle px-3 py-1.5">All</Link>
        {ORG_IDS.map((o) => (
          <Link key={o} href={`/admin/events?org=${o}`} className="rounded-full bg-subtle px-3 py-1.5">{o.toUpperCase()}</Link>
        ))}
        <Link href="/admin/events?v=unverified" className="rounded-full bg-subtle px-3 py-1.5">Unverified only</Link>
      </nav>
      <p className="mt-4 text-sm text-muted">{rows.length} events · {rows.filter((r) => r.verification === "unverified").length} unverified</p>
      <ul className="mt-3 divide-y divide-border rounded-3xl border border-border px-5">
        {rows.map((e) => (
          <li key={e.id}>
            <Link href={`/admin/events/${e.id}`} className="-mx-5 flex items-center gap-4 px-5 py-3 hover:bg-subtle/60">
              <span className="w-24 text-xs text-muted">{e.org.toUpperCase()} {e.code}</span>
              <span className="flex-1">{e.name}{!e.active ? " (inactive)" : ""}</span>
              <span className="text-xs text-muted">{e.sourceCheckedAt ?? "never checked"}</span>
              <VerificationChip status={e.verification} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
