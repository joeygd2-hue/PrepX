"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, ChevronRight, Search } from "lucide-react";
import { Input, Label } from "@/components/ui/form";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type { OrgId } from "@/lib/orgs";

type E = { id: string; code: string; name: string; category: string; cluster: string | null; formatLabel: string };

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export function EventChooser({ org, events, selectedId, placeholder }: { org: OrgId; events: E[]; selectedId: string | null; placeholder: string }) {
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? events.filter((e) => [e.code, e.name, e.category, e.cluster ?? "", e.formatLabel].join(" ").toLowerCase().includes(needle))
      : events;
    const m = new Map<string, E[]>();
    for (const e of filtered) m.set(e.category, [...(m.get(e.category) ?? []), e]);
    return [...m.entries()];
  }, [q, events]);
  const shown = groups.reduce((n, [, list]) => n + list.length, 0);
  return (
    <div className="mt-6">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <Label htmlFor="event-search" className="mb-0">
          Search
        </Label>
        <p className="font-mono text-xs text-muted tabular" aria-live="polite">
          {shown} {shown === 1 ? "event" : "events"}
        </p>
      </div>
      <div className="sticky top-3 z-10">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-muted" aria-hidden />
        <Input id="event-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="pl-11 shadow-card" />
      </div>
      {groups.length === 0 ? (
        <Card tone="subtle" className="mt-8 text-center">
          <p className="text-muted">No events match &ldquo;{q}&rdquo;.</p>
        </Card>
      ) : null}
      {groups.map(([cat, list]) => (
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
          <ul className="divide-y divide-border overflow-hidden rounded-[24px] border border-border bg-card px-4 shadow-card sm:px-5">
            {list.map((e) => {
              const selected = e.id === selectedId;
              return (
                <li key={e.id}>
                  <Link href={`/study/events/${e.id}`} className="group/row -mx-4 flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-subtle/60 sm:-mx-5 sm:px-5">
                    <span
                      className={cn(
                        "inline-flex h-10 w-14 shrink-0 items-center justify-center rounded-[12px] font-mono text-[11px] font-semibold tracking-wider",
                        selected ? "bg-primary text-primary-fg" : "border border-border bg-subtle/70",
                      )}
                    >
                      {e.code}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium leading-snug tracking-[-0.01em]">{e.name}</span>
                      <span className="mt-0.5 block text-sm text-muted">{org === "deca" && e.cluster ? e.cluster : e.formatLabel}</span>
                    </span>
                    {selected ? (
                      <span role="img" aria-label="Your event" className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg">
                        <Check className="size-4" strokeWidth={3} aria-hidden />
                      </span>
                    ) : (
                      <ChevronRight className="size-4 shrink-0 text-muted transition-transform duration-200 group-hover/row:translate-x-0.5 group-hover/row:text-fg" aria-hidden />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <div className="mt-10 flex justify-center">
        <ButtonLink href="/study" variant="ghost">
          Cancel
        </ButtonLink>
      </div>
    </div>
  );
}
