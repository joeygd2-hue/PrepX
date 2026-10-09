/**
 * Date helpers. Competition dates are stored as calendar dates (YYYY-MM-DD) in the
 * competition's own time zone; "days to go" compares calendar days in the viewer's zone
 * so the number changes exactly at the viewer's local midnight.
 */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

const dayNumber = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};

export function daysBetween(fromYmd: string, toYmd: string) {
  return dayNumber(toYmd) - dayNumber(fromYmd);
}

export function daysUntil(targetYmd: string, timeZone: string, now: Date = new Date()) {
  return daysBetween(todayIn(timeZone, now), targetYmd);
}

export function addDays(ymd: string, n: number) {
  const d = new Date(dayNumber(ymd) * 86400000 + n * 86400000);
  return d.toISOString().slice(0, 10);
}

const fmt = (ymd: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...opts }).format(new Date(`${ymd}T12:00:00Z`));

/** "Sat, Apr 17 – Tue, Apr 20" */
export function formatRange(start: string, end: string) {
  const o: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" };
  return start === end ? fmt(start, o) : `${fmt(start, o)} – ${fmt(end, o)}`;
}

export const formatDay = (ymd: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric" }) => fmt(ymd, opts);

/** Competition season runs Aug 1 – Jul 31. Returns e.g. "2026-2027". */
export function seasonKey(ymd: string) {
  const [y, m] = ymd.split("-").map(Number);
  const start = m >= 8 ? y : y - 1;
  return `${start}-${start + 1}`;
}

export function weeksLabel(days: number) {
  const w = Math.round(days / 7);
  return w <= 1 ? "about a week" : `about ${w} weeks`;
}
