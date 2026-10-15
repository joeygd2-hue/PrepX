/**
 * Study planner helpers (pure). Days are calendar dates (YYYY-MM-DD) so the results never
 * depend on the server's time zone; callers turn "now" into a local date with todayIn().
 */
import { addDays, todayIn } from "./dates";

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];
/** Minutes per weekday; a missing day or 0 is a rest day. null = every day at dailyStudyMinutes. */
export type StudyDays = Partial<Record<Weekday, number>>;

export const WEEKDAY_NAMES: Record<Weekday, { short: string; long: string }> = {
  mon: { short: "Mon", long: "Monday" },
  tue: { short: "Tue", long: "Tuesday" },
  wed: { short: "Wed", long: "Wednesday" },
  thu: { short: "Thu", long: "Thursday" },
  fri: { short: "Fri", long: "Friday" },
  sat: { short: "Sat", long: "Saturday" },
  sun: { short: "Sun", long: "Sunday" },
};

export const MINUTE_OPTIONS = [15, 20, 30, 45, 60] as const;
export const DEFAULT_REMINDER_TIME = "18:00";
export const REMINDER_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_DAY_MINUTES = 240;

const clampMinutes = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(MAX_DAY_MINUTES, Math.round(n))) : 0);

/** Weekday key of a calendar date ("2026-10-12" → "mon"). */
export function weekdayOf(ymd: string): Weekday {
  const [y, m, d] = ymd.split("-").map(Number);
  return WEEKDAYS[(new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7];
}

/** Minutes planned for a weekday (0 = rest day). */
export function minutesForWeekday(studyDays: StudyDays | null | undefined, dailyStudyMinutes: number, day: Weekday): number {
  if (!studyDays) return clampMinutes(dailyStudyMinutes);
  return clampMinutes(studyDays[day]);
}

/** Minutes planned for a calendar date (0 = rest day). */
export function minutesForDay(studyDays: StudyDays | null | undefined, dailyStudyMinutes: number, ymd: string): number {
  return minutesForWeekday(studyDays, dailyStudyMinutes, weekdayOf(ymd));
}

export function isStudyDay(studyDays: StudyDays | null | undefined, dailyStudyMinutes: number, ymd: string): boolean {
  return minutesForDay(studyDays, dailyStudyMinutes, ymd) > 0;
}

export function weeklyMinutes(studyDays: StudyDays | null | undefined, dailyStudyMinutes: number): number {
  return WEEKDAYS.reduce((sum, d) => sum + minutesForWeekday(studyDays, dailyStudyMinutes, d), 0);
}

/** The first study day strictly after `afterYmd` (within a week), or null when every day is a rest day. */
export function nextStudyDay(studyDays: StudyDays | null | undefined, dailyStudyMinutes: number, afterYmd: string): string | null {
  for (let i = 1; i <= 7; i++) {
    const day = addDays(afterYmd, i);
    if (isStudyDay(studyDays, dailyStudyMinutes, day)) return day;
  }
  return null;
}

/** Local hour (0-23) for study reminders; 6 pm unless the student picked a valid "HH:MM". */
export function reminderHour(studyReminderTime: string | null | undefined): number {
  const t = studyReminderTime && REMINDER_TIME_RE.test(studyReminderTime) ? studyReminderTime : DEFAULT_REMINDER_TIME;
  return Number(t.slice(0, 2));
}

/** "18:30" → "6:30 PM". Falls back to the default time for missing or invalid input. */
export function formatReminderTime(studyReminderTime: string | null | undefined): string {
  const t = studyReminderTime && REMINDER_TIME_RE.test(studyReminderTime) ? studyReminderTime : DEFAULT_REMINDER_TIME;
  const h = Number(t.slice(0, 2));
  return `${h % 12 === 0 ? 12 : h % 12}:${t.slice(3)} ${h < 12 ? "AM" : "PM"}`;
}

/** 45 → "45 min", 60 → "1 hr", 195 → "3 hr 15 min". */
export function formatMinutes(total: number): string {
  const m = Number.isFinite(total) ? Math.max(0, Math.round(total)) : 0;
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} hr ${rest} min` : `${h} hr`;
}

/** The closest allowed planner option (for older profiles saved with other values, e.g. 10). */
export function snapMinutes(n: number): (typeof MINUTE_OPTIONS)[number] {
  return MINUTE_OPTIONS.reduce((best, o) => (Math.abs(o - n) < Math.abs(best - n) ? o : best), MINUTE_OPTIONS[0]);
}

/** The most common minutes across study days (ties go to the longer session); null when there are none. */
export function typicalMinutes(studyDays: StudyDays): number | null {
  const counts = new Map<number, number>();
  for (const d of WEEKDAYS) {
    const m = clampMinutes(studyDays[d]);
    if (m > 0) counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  let best: number | null = null;
  for (const [m, c] of counts) if (best === null || c > counts.get(best)! || (c === counts.get(best)! && m > best)) best = m;
  return best;
}

/**
 * Stored form of a week: rest days are 0, and a week with every day at the same length is
 * stored as null so the profile's daily study time stays the single source of truth.
 */
export function normalizeStudyDays(studyDays: StudyDays): StudyDays | null {
  const week = Object.fromEntries(WEEKDAYS.map((d) => [d, clampMinutes(studyDays[d])])) as Record<Weekday, number>;
  const first = week.mon;
  return first > 0 && WEEKDAYS.every((d) => week[d] === first) ? null : week;
}

/** Minutes planned for the student's local today (feeds today's plan). */
export function minutesForToday(profile: { studyDays: StudyDays | null; dailyStudyMinutes: number }, tz: string, now: Date = new Date()): number {
  return minutesForDay(profile.studyDays, profile.dailyStudyMinutes, todayIn(tz, now));
}
