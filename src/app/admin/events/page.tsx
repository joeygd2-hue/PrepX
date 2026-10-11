import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { ChevronRight } from "lucide-react";
import { db, schema } from "@/db";
import { VerificationChip } from "@/components/ui/badge";
import { Accent, PageTitle } from "@/components/ui/page";
import { cn } from "@/lib/cn";
import { isOrg, ORG_IDS } from "@/lib/orgs";

export const metadata = { title: "Events" };

export default async function Events({ searchParams }: { searchParams: Promise<{ org?: string; v?: string }> }) {
  const { org, v } = await searchParams;
  const rows = await db
    .select()
    .from(schema.events)
    .where(and(isOrg(org) ? eq(schema.events.org, org) : undefined, v === "unverified" ? eq(schema.events.verification, "unverified") : undefined))
    .orderBy(asc(schema.events.org), asc(schema.events.position));
  const filters: [href: string, label: string, active: boolean][] = [
    ["/admin/events", "All", !isOrg(org) && v !== "unverified"],
    ...ORG_IDS.map((o): [string, string, boolean] => [`/admin/events?org=${o}`, o.toUpperCase(), org === o && v !== "unverified"]),
    ["/admin/events?v=unverified", "Unverified only", !isOrg(org) && v === "unverified"],
  ];
  return (
    <div className="stagger">
      <PageTitle
        title={
          <>
            Event <Accent>catalog</Accent>
          </>
        }
        subtitle="Update formats only from official guidelines, then mark them verified with the source and date checked."
      />
      <nav aria-label="Event filters" className="flex w-fit max-w-full gap-0.5 overflow-x-auto rounded-[14px] bg-subtle p-1 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {filters.map(([href, label, active]) => (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-10 shrink-0 items-center whitespace-nowrap rounded-[11px] px-3.5 font-medium transition-colors duration-200",
              active ? "bg-card text-fg shadow-card" : "text-muted hover:text-fg",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
      <p className="mt-6 mb-3 font-mono text-xs text-muted tabular">
        {rows.length} events · {rows.filter((r) => r.verification === "unverified").length} unverified
      </p>
      <ul className="divide-y divide-border overflow-hidden rounded-[24px] border border-border bg-card px-4 shadow-card sm:px-5">
        {rows.map((e) => (
          <li key={e.id}>
            <Link
              href={`/admin/events/${e.id}`}
              className="group/row -mx-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3.5 transition-colors hover:bg-subtle/60 sm:-mx-5 sm:flex-nowrap sm:gap-x-4 sm:px-5"
            >
              <span className="font-mono text-xs text-muted tabular sm:w-24 sm:shrink-0">
                {e.org.toUpperCase()} {e.code}
              </span>
              <span className="order-first w-full min-w-0 font-medium tracking-[-0.01em] sm:order-none sm:w-auto sm:flex-1">
                {e.name}
                {!e.active ? " (inactive)" : ""}
              </span>
              <span className="ml-auto font-mono text-xs text-muted tabular sm:ml-0">{e.sourceCheckedAt ?? "never checked"}</span>
              <VerificationChip status={e.verification} />
              <ChevronRight
                className="hidden size-4 shrink-0 text-muted transition-transform duration-200 group-hover/row:translate-x-0.5 group-hover/row:text-fg sm:block"
                aria-hidden
              />
            </Link>
          </li>
        ))}
        {!rows.length ? <li className="py-4 text-muted">No events match this filter.</li> : null}
      </ul>
    </div>
  );
}
