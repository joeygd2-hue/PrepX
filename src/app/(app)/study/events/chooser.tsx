"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Input, Label } from "@/components/ui/form";
import type { OrgId } from "@/lib/orgs";

type E = { id: string; code: string; name: string; category: string; cluster: string | null; formatLabel: string };

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
  return (
    <div className="mt-6">
      <Label htmlFor="event-search">Search</Label>
      <Input id="event-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="border-transparent bg-subtle" />
      {groups.length === 0 ? <p className="mt-8 text-center text-muted">No events match &ldquo;{q}&rdquo;.</p> : null}
      {groups.map(([cat, list]) => (
        <section key={cat} aria-labelledby={`cat-${cat}`}>
          <h2 id={`cat-${cat}`} className="eyebrow mt-8 mb-3">
            {cat}
          </h2>
          <ul className="divide-y divide-border rounded-3xl border border-border px-5">
            {list.map((e) => (
              <li key={e.id}>
                <Link href={`/study/events/${e.id}`} className="-mx-5 flex items-center gap-4 px-5 py-4 hover:bg-subtle/60">
                  <span className="w-16 shrink-0 break-all text-xs font-semibold text-muted">{e.code}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{e.name}</span>
                    <span className="block text-sm text-muted">{org === "deca" && e.cluster ? e.cluster : e.formatLabel}</span>
                  </span>
                  {e.id === selectedId ? <CheckCircle2 className="size-6 shrink-0 fill-fg text-bg" aria-label="Your event" /> : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <div className="mt-8 text-center">
        <Link href="/study" className="font-medium">
          Cancel
        </Link>
      </div>
    </div>
  );
}
