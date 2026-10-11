import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { ChevronRight } from "lucide-react";
import { db, schema } from "@/db";
import { isOrg, ORGS, ORG_IDS } from "@/lib/orgs";
import { PublicPage, PublicTitle } from "@/components/shell/public-page";
import { Accent } from "@/components/ui/page";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Competitive events" };

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export default async function Events({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const { org: o } = await searchParams;
  const org = isOrg(o) ? o : "deca";
  const events = await db.select().from(schema.events).where(eq(schema.events.org, org)).orderBy(asc(schema.events.position));
  const groups = new Map<string, typeof events>();
  for (const e of events) groups.set(e.category, [...(groups.get(e.category) ?? []), e]);
  return (
    <PublicPage>
      <PublicTitle
        title={
          <>
            Competitive <Accent>events</Accent>
          </>
        }
        lead="2026–2027 high school events PrepX supports. Formats marked unverified should be confirmed in the official guidelines."
      />
      <nav aria-label="Organization" className="grid grid-cols-4 gap-1 rounded-[16px] border border-border bg-subtle/80 p-1">
        {ORG_IDS.map((x) => (
          <Link
            key={x}
            href={`/events?org=${x}`}
            aria-current={x === org ? "page" : undefined}
            className={cn(
              "flex h-10 items-center justify-center gap-2 rounded-[12px] font-mono text-xs font-semibold tracking-wider transition-colors",
              x === org ? "bg-card text-fg shadow-card" : "text-muted hover:text-fg",
            )}
          >
            <span className="size-1.5 rounded-full" style={{ background: `var(--${x})` }} aria-hidden />
            {ORGS[x].name}
          </Link>
        ))}
      </nav>
      <div className="stagger">
        {[...groups.entries()].map(([cat, list]) => (
          <section key={cat} aria-labelledby={`cat-${slug(cat)}`} className="mt-9">
            <div className="mb-3 flex items-center gap-3">
              <h2 id={`cat-${slug(cat)}`} className="eyebrow min-w-0">
                {cat}
              </h2>
              <span className="h-px flex-1 bg-border" aria-hidden />
              <span className="font-mono text-[11px] text-muted tabular" aria-hidden>
                {String(list.length).padStart(2, "0")}
              </span>
            </div>
            <ul className="divide-y divide-border overflow-hidden rounded-[24px] border border-border bg-card shadow-card">
              {list.map((e) => (
                <li key={e.id}>
                  <Link href={`/events/${e.id}`} className="group/row flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-subtle/60 sm:px-5">
                    <span className="inline-flex h-10 w-14 shrink-0 items-center justify-center rounded-[12px] border border-border bg-subtle/70 font-mono text-[11px] font-semibold tracking-wider">
                      {e.code}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium leading-snug tracking-[-0.01em]">{e.name}</span>
                      <span className="mt-0.5 block text-sm text-muted">{e.formatLabel}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted transition-transform duration-200 group-hover/row:translate-x-0.5 group-hover/row:text-fg" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </PublicPage>
  );
}
