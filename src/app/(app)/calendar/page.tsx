import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus, Download, MapPin, Settings2 } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { calendarItems, type CalItem } from "@/server/calendar";
import { formatDay, formatRange, todayIn, daysBetween } from "@/lib/dates";
import { googleCalendarUrl } from "@/lib/ics";
import { ORGS, ORG_IDS, type OrgId } from "@/lib/orgs";
import { Page, PageTitle, EmptyState } from "@/components/ui/page";
import { OrgBadge, VerificationChip, Chip } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { CalendarDays } from "lucide-react";

export const metadata: Metadata = { title: "Calendar" };

const LEVELS = [
  ["all", "All"],
  ["official", "Official"],
  ["personal", "My plan"],
] as const;

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ org?: string; level?: string; view?: string; month?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const tz = user.profile!.timezone;
  const today = todayIn(tz);
  const all = await calendarItems(user.id, tz);
  const items = all.filter(
    (i) =>
      (!sp.org || i.org === sp.org) &&
      (!sp.level || sp.level === "all" || (sp.level === "official" ? i.kind === "competition" : i.kind !== "competition")),
  );
  const view = sp.view === "month" ? "month" : "agenda";
  const q = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([, v]) => v) as [string, string][]);
    return `/calendar?${p}`;
  };
  return (
    <Page>
      <PageTitle
        title="Calendar"
        right={
          <Link href="/calendar/region" className="inline-flex items-center gap-2 rounded-full bg-subtle px-4 py-2 text-sm font-medium hover:bg-subtle-2">
            <Settings2 className="size-4" aria-hidden /> Your competitions
          </Link>
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link href={q({ org: undefined })} className={cn("rounded-full px-3 py-1.5 text-sm", !sp.org ? "bg-fg text-bg" : "bg-subtle")}>
          All orgs
        </Link>
        {ORG_IDS.map((o) => (
          <Link key={o} href={q({ org: o })} className={cn("rounded-full px-3 py-1.5 text-sm", sp.org === o ? "bg-fg text-bg" : "bg-subtle")}>
            {ORGS[o].name}
          </Link>
        ))}
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        {LEVELS.map(([v, l]) => (
          <Link key={v} href={q({ level: v === "all" ? undefined : v })} className={cn("rounded-full px-3 py-1.5 text-sm", (sp.level ?? "all") === v ? "bg-fg text-bg" : "bg-subtle")}>
            {l}
          </Link>
        ))}
      </div>
      <div className="mb-5 flex items-center justify-between">
        <div role="tablist" aria-label="View" className="inline-flex rounded-full bg-subtle p-1">
          {(["agenda", "month"] as const).map((v) => (
            <Link key={v} role="tab" aria-selected={view === v} href={q({ view: v === "agenda" ? undefined : v })} className={cn("rounded-full px-4 py-1.5 text-sm font-medium capitalize", view === v && "bg-fg text-bg")}>
              {v}
            </Link>
          ))}
        </div>
        {items.length ? (
          <a href="/api/calendar/all" className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline">
            <Download className="size-4" aria-hidden /> Export all (.ics)
          </a>
        ) : null}
      </div>
      {!all.length ? (
        <EmptyState
          icon={<CalendarDays />}
          title="Nothing on your calendar yet"
          body="Turn on dates for your organizations and pick your district or area to see official competition dates. Your study milestones appear once you choose an event."
          action={<ButtonLink href="/calendar/region">Choose your competitions</ButtonLink>}
        />
      ) : view === "month" ? (
        <MonthView items={items} today={today} month={sp.month} hrefFor={(m) => q({ month: m })} />
      ) : (
        <Agenda items={items.filter((i) => i.end >= today)} today={today} />
      )}
      <p className="mt-8 text-sm text-muted">
        Official dates come from each organization&apos;s published calendar and show their source. Dates marked tentative or unconfirmed may change; always check with your advisor.
      </p>
    </Page>
  );
}

function Agenda({ items, today }: { items: CalItem[]; today: string }) {
  if (!items.length) return <p className="text-muted">No upcoming dates match these filters.</p>;
  return (
    <ol className="space-y-3">
      {items.map((i) => {
        const days = daysBetween(today, i.start);
        const ics = { uid: i.id, title: i.title, start: i.start, end: i.end, description: i.note ?? undefined, location: i.location ?? undefined, url: i.sourceUrl ?? undefined };
        return (
          <li key={i.id} className={cn("rounded-3xl p-5", i.kind === "competition" ? "border border-border" : "bg-subtle")}>
            <div className="flex flex-wrap items-center gap-2">
              <OrgBadge org={i.org as OrgId} />
              {i.kind === "competition" ? <Chip>{i.level}</Chip> : <Chip>{i.kind === "milestone" ? "Study milestone" : "Your date"}</Chip>}
              {i.kind === "competition" && i.status !== "confirmed" ? <VerificationChip status={i.status} /> : null}
              <span className="ml-auto text-sm text-muted tabular">{days === 0 ? "Today" : days > 0 ? `in ${days}d` : "Now"}</span>
            </div>
            <p className="mt-3 font-semibold">{i.title}</p>
            <p className="text-sm text-muted">
              {i.start === i.end ? formatDay(i.start) : formatRange(i.start, i.end)}
              {i.location ? (
                <>
                  {" "}
                  · <MapPin className="inline size-3.5" aria-hidden /> {i.location}
                </>
              ) : null}
            </p>
            {i.note ? <p className="mt-1 text-sm text-muted">{i.note}</p> : null}
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <a href={`/api/calendar/item?id=${encodeURIComponent(i.id)}`} className="inline-flex items-center gap-1 font-medium hover:underline">
                <CalendarPlus className="size-4" aria-hidden /> Apple / Outlook (.ics)
              </a>
              <a href={googleCalendarUrl(ics)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium hover:underline">
                <CalendarPlus className="size-4" aria-hidden /> Google Calendar
              </a>
              {i.sourceUrl ? (
                <a href={i.sourceUrl} target="_blank" rel="noreferrer" className="text-muted hover:underline">
                  Source
                </a>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function MonthView({ items, today, month, hrefFor }: { items: CalItem[]; today: string; month?: string; hrefFor: (m: string) => string }) {
  const m = month && /^\d{4}-\d{2}$/.test(month) ? month : today.slice(0, 7);
  const [y, mo] = m.split("-").map(Number);
  const first = new Date(Date.UTC(y, mo - 1, 1));
  const daysIn = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const lead = first.getUTCDay();
  const prev = new Date(Date.UTC(y, mo - 2, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 7);
  const cells = Array.from({ length: lead + daysIn }, (_, i) => (i < lead ? null : `${m}-${String(i - lead + 1).padStart(2, "0")}`));
  const on = (d: string) => items.filter((i) => i.start <= d && i.end >= d);
  const monthItems = items.filter((i) => i.start.slice(0, 7) <= m && i.end.slice(0, 7) >= m);
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Link href={hrefFor(prev)} className="rounded-full bg-subtle px-3 py-1.5 text-sm" aria-label="Previous month">
          ←
        </Link>
        <p className="font-semibold">{first.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}</p>
        <Link href={hrefFor(next)} className="rounded-full bg-subtle px-3 py-1.5 text-sm" aria-label="Next month">
          →
        </Link>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted" aria-hidden>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d, i) =>
          d ? (
            <div key={d} className={cn("flex aspect-square flex-col items-center justify-start rounded-xl p-1 text-sm", d === today ? "bg-fg text-bg" : "bg-subtle")} aria-label={`${d}${on(d).length ? `: ${on(d).map((x) => x.title).join(", ")}` : ""}`}>
              <span className="tabular">{Number(d.slice(8))}</span>
              <span className="mt-auto flex gap-0.5">
                {on(d)
                  .slice(0, 3)
                  .map((x) => (
                    <span key={x.id} className="size-1.5 rounded-full" style={{ background: x.kind === "competition" ? ORGS[x.org].color : "currentColor" }} />
                  ))}
              </span>
            </div>
          ) : (
            <span key={`e${i}`} />
          ),
        )}
      </div>
      <div className="mt-6">
        <Agenda items={monthItems} today={today} />
      </div>
    </div>
  );
}
