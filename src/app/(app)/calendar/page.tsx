import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Download, ExternalLink, Flag, MapPin, Settings2 } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { calendarItems, type CalItem } from "@/server/calendar";
import { formatDay, formatRange, todayIn, daysBetween } from "@/lib/dates";
import { googleCalendarUrl } from "@/lib/ics";
import { ORGS, ORG_IDS, type OrgId } from "@/lib/orgs";
import { Accent, Page, PageTitle, EmptyState } from "@/components/ui/page";
import { OrgBadge, VerificationChip, Chip } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Calendar" };

const LEVELS = [
  ["all", "All"],
  ["official", "Official"],
  ["personal", "My plan"],
] as const;

const filterChip = (active: boolean) =>
  cn(
    "inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-colors",
    active ? "bg-primary text-primary-fg" : "border border-border bg-card text-muted hover:border-border-strong hover:text-fg",
  );
const actionLink = "inline-flex h-9 items-center gap-1.5 rounded-[11px] border border-border-strong bg-card px-3 text-[13px] font-medium transition-colors hover:border-fg/40 hover:bg-subtle/60";

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
        eyebrow={formatDay(today)}
        title={<Accent>Calendar</Accent>}
        right={
          <ButtonLink href="/calendar/region" variant="outline" size="sm" className="shrink-0">
            <Settings2 className="size-4" aria-hidden /> <span className="max-[380px]:sr-only">Your competitions</span>
          </ButtonLink>
        }
      />
      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="View" className="inline-flex rounded-[14px] bg-subtle p-1">
            {(["agenda", "month"] as const).map((v) => (
              <Link
                key={v}
                role="tab"
                aria-selected={view === v}
                href={q({ view: v === "agenda" ? undefined : v })}
                className={cn("inline-flex h-9 items-center rounded-[11px] px-4 text-sm font-medium capitalize transition-colors", view === v ? "bg-card text-fg shadow-card" : "text-muted hover:text-fg")}
              >
                {v}
              </Link>
            ))}
          </div>
          {items.length ? (
            <a href="/api/calendar/all" className={actionLink}>
              <Download className="size-4" aria-hidden /> Export all (.ics)
            </a>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Link href={q({ org: undefined })} className={filterChip(!sp.org)}>
            All orgs
          </Link>
          {ORG_IDS.map((o) => (
            <Link key={o} href={q({ org: o })} className={cn(filterChip(sp.org === o), "font-mono text-xs font-semibold tracking-wider")}>
              <span className="size-1.5 rounded-full" style={{ background: `var(--${o})` }} aria-hidden />
              {ORGS[o].name}
            </Link>
          ))}
          <span className="mx-1 h-5 w-px bg-border-strong" aria-hidden />
          {LEVELS.map(([v, l]) => (
            <Link key={v} href={q({ level: v === "all" ? undefined : v })} className={filterChip((sp.level ?? "all") === v)}>
              {l}
            </Link>
          ))}
        </div>
      </div>
      {!all.length ? (
        <EmptyState
          icon={<CalendarDays />}
          title="Nothing on your calendar yet"
          body="Turn on dates for your organizations and pick your district or area to see official competition dates. Your study milestones appear once you choose an event."
          action={
            <ButtonLink href="/calendar/region" variant="accent">
              Choose your competitions
            </ButtonLink>
          }
        />
      ) : view === "month" ? (
        <MonthView items={items} today={today} month={sp.month} hrefFor={(m) => q({ month: m })} />
      ) : (
        <Agenda items={items.filter((i) => i.end >= today)} today={today} />
      )}
      <p className="mt-10 text-sm text-muted">
        Official dates come from each organization&apos;s published calendar and show their source. Dates marked tentative or unconfirmed may change; always check with your advisor.
      </p>
    </Page>
  );
}

const monthLabel = (ymd: string) => formatDay(ymd, { month: "long", year: "numeric" });
const underway = (i: CalItem, today: string) => i.start < today && i.end >= today;
/** The day an item is listed under: its start, or today for something already under way. */
const shownDay = (i: CalItem, today: string) => (underway(i, today) ? today : i.start);

/** Upcoming items as a timeline grouped by month: mono date column, then a card per item. */
function Agenda({ items, today }: { items: CalItem[]; today: string }) {
  if (!items.length)
    return (
      <Card tone="subtle">
        <p className="text-muted">No upcoming dates match these filters.</p>
      </Card>
    );
  const months: { key: string; items: CalItem[] }[] = [];
  for (const i of [...items].sort((a, b) => shownDay(a, today).localeCompare(shownDay(b, today)))) {
    const key = shownDay(i, today).slice(0, 7);
    const last = months[months.length - 1];
    if (last?.key === key) last.items.push(i);
    else months.push({ key, items: [i] });
  }
  return (
    <div className="space-y-8">
      {months.map((m) => (
        <section key={m.key}>
          <h2 className="eyebrow mb-3 flex items-center gap-3">
            <span className="shrink-0">{monthLabel(`${m.key}-01`)}</span>
            <span className="h-px flex-1 bg-border" aria-hidden />
          </h2>
          <ol className="stagger space-y-3">
            {m.items.map((i) => (
              <AgendaItem key={i.id} item={i} today={today} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function AgendaItem({ item: i, today }: { item: CalItem; today: string }) {
  const days = daysBetween(today, i.start);
  const now = underway(i, today);
  const shown = shownDay(i, today);
  const ics = { uid: i.id, title: i.title, start: i.start, end: i.end, description: i.note ?? undefined, location: i.location ?? undefined, url: i.sourceUrl ?? undefined };
  const official = i.kind === "competition";
  return (
    <li className="flex gap-3 sm:gap-4">
      <div className="w-11 shrink-0 pt-4 text-center sm:w-12" aria-hidden>
        <p className="font-mono text-[1.6rem] font-medium leading-none tracking-[-0.04em] tabular">{Number(shown.slice(8))}</p>
        <p className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">{formatDay(shown, { weekday: "short" })}</p>
      </div>
      <article className={cn("min-w-0 flex-1 rounded-[20px] p-4 sm:p-5", official ? "border border-border bg-card shadow-card" : "bg-subtle")}>
        <div className="flex flex-wrap items-center gap-2">
          <OrgBadge org={i.org as OrgId} />
          {official ? (
            <Chip className="capitalize">{i.level}</Chip>
          ) : (
            <Chip className="gap-1.5">
              {i.kind === "milestone" ? <Flag className="size-3" aria-hidden /> : null}
              {i.kind === "milestone" ? "Study milestone" : "Your date"}
            </Chip>
          )}
          {official && i.status !== "confirmed" ? <VerificationChip status={i.status} /> : null}
          {days >= 0 || now ? (
            <span className={cn("ml-auto rounded-full px-2 py-0.5 font-mono text-xs tabular", days > 0 ? "text-muted" : "bg-accent font-medium text-accent-fg")}>
              {days === 0 ? "Today" : days > 0 ? `in ${days}d` : "Now"}
            </span>
          ) : null}
        </div>
        <p className="mt-3 font-semibold leading-snug tracking-[-0.01em] [overflow-wrap:anywhere]">{i.title}</p>
        <p className="mt-1 font-mono text-xs text-muted tabular">
          {i.start === i.end ? formatDay(i.start) : formatRange(i.start, i.end)}
          {i.location ? (
            <>
              {" "}
              · <MapPin className="inline size-3.5 align-[-2px]" aria-hidden /> {i.location}
            </>
          ) : null}
        </p>
        {i.note ? <p className="mt-2 text-sm leading-relaxed text-muted">{i.note}</p> : null}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <a href={`/api/calendar/item?id=${encodeURIComponent(i.id)}`} className={actionLink}>
            <CalendarPlus className="size-4" aria-hidden /> Apple / Outlook (.ics)
          </a>
          <a href={googleCalendarUrl(ics)} target="_blank" rel="noreferrer" className={actionLink}>
            <CalendarPlus className="size-4" aria-hidden /> Google Calendar
          </a>
          {i.sourceUrl ? (
            <a href={i.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1 px-1.5 text-[13px] text-muted transition-colors hover:text-fg">
              Source <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : null}
        </div>
      </article>
    </li>
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
  const navBtn = "inline-flex size-10 items-center justify-center rounded-[12px] border border-border bg-card shadow-card transition-colors hover:border-border-strong";
  return (
    <div>
      <Card className="p-3 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link href={hrefFor(prev)} className={navBtn} aria-label="Previous month">
            <ChevronLeft className="size-[18px]" aria-hidden />
          </Link>
          <p className="text-lg font-semibold tracking-[-0.02em]">{first.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}</p>
          <Link href={hrefFor(next)} className={navBtn} aria-label="Next month">
            <ChevronRight className="size-[18px]" aria-hidden />
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-muted" aria-hidden>
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <span key={`e${i}`} />;
            const here = on(d);
            return (
              <div
                key={d}
                className={cn(
                  "flex aspect-square flex-col items-center justify-start rounded-[12px] p-1 text-sm",
                  d === today ? "bg-accent font-semibold text-accent-fg" : here.length ? "bg-subtle-2" : "bg-subtle/60",
                )}
                aria-label={`${d}${here.length ? `: ${here.map((x) => x.title).join(", ")}` : ""}`}
              >
                <span className="font-mono tabular">{Number(d.slice(8))}</span>
                <span className="mt-auto flex gap-0.5 pb-0.5">
                  {here.slice(0, 3).map((x) => (
                    <span key={x.id} className="size-1.5 rounded-full" style={{ background: x.kind === "competition" ? `var(--${x.org})` : "currentColor" }} />
                  ))}
                </span>
              </div>
            );
          })}
        </div>
      </Card>
      <div className="mt-8">
        <Agenda items={monthItems} today={today} />
      </div>
    </div>
  );
}
