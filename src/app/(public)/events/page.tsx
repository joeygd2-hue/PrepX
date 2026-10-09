import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { isOrg, ORGS, ORG_IDS } from "@/lib/orgs";
import { PublicPage } from "@/components/shell/public-page";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Competitive events" };

export default async function Events({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const { org: o } = await searchParams;
  const org = isOrg(o) ? o : "deca";
  const events = await db.select().from(schema.events).where(eq(schema.events.org, org)).orderBy(asc(schema.events.position));
  const groups = new Map<string, typeof events>();
  for (const e of events) groups.set(e.category, [...(groups.get(e.category) ?? []), e]);
  return (
    <PublicPage>
      <h1 className="text-4xl font-bold tracking-tight">Competitive events</h1>
      <p className="mt-2 text-muted">2026–2027 high school events PrepX supports. Formats marked unverified should be confirmed in the official guidelines.</p>
      <nav className="mt-6 flex gap-2">
        {ORG_IDS.map((x) => (
          <Link key={x} href={`/events?org=${x}`} className={cn("rounded-full px-4 py-2 text-sm font-medium", x === org ? "bg-fg text-bg" : "bg-subtle")}>
            {ORGS[x].name}
          </Link>
        ))}
      </nav>
      {[...groups.entries()].map(([cat, list]) => (
        <section key={cat}>
          <h2 className="eyebrow mt-8 mb-3">{cat}</h2>
          <ul className="divide-y divide-border rounded-3xl border border-border px-5">
            {list.map((e) => (
              <li key={e.id}>
                <Link href={`/events/${e.id}`} className="-mx-5 flex gap-4 px-5 py-3 hover:bg-subtle/60">
                  <span className="w-16 shrink-0 text-xs font-semibold text-muted">{e.code}</span>
                  <span className="flex-1">
                    <span className="block font-medium">{e.name}</span>
                    <span className="text-sm text-muted">{e.formatLabel}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </PublicPage>
  );
}
