import { describe, expect, it } from "vitest";
import {
  formatMinutes,
  formatReminderTime,
  isStudyDay,
  minutesForDay,
  minutesForToday,
  nextStudyDay,
  normalizeStudyDays,
  reminderHour,
  snapMinutes,
  typicalMinutes,
  weekdayOf,
  weeklyMinutes,
  type StudyDays,
} from "@/lib/planner";

// 2026-10-12 is a Monday; 2026-10-18 is the Sunday after it.
const weekdaysOnly: StudyDays = { mon: 30, tue: 30, wed: 45, thu: 30, fri: 20, sat: 0, sun: 0 };

describe("study planner", () => {
  it("maps calendar dates to weekday keys", () => {
    expect(weekdayOf("2026-10-12")).toBe("mon");
    expect(weekdayOf("2026-10-16")).toBe("fri");
    expect(weekdayOf("2026-10-18")).toBe("sun");
    expect(weekdayOf("2027-01-01")).toBe("fri");
  });

  it("uses the daily study time every day when no week is planned", () => {
    expect(minutesForDay(null, 20, "2026-10-12")).toBe(20);
    expect(minutesForDay(null, 20, "2026-10-18")).toBe(20);
    expect(isStudyDay(null, 20, "2026-10-17")).toBe(true);
    expect(weeklyMinutes(null, 20)).toBe(140);
  });

  it("treats 0 and missing days as rest days", () => {
    expect(minutesForDay(weekdaysOnly, 20, "2026-10-14")).toBe(45);
    expect(minutesForDay(weekdaysOnly, 20, "2026-10-17")).toBe(0);
    expect(isStudyDay(weekdaysOnly, 20, "2026-10-17")).toBe(false);
    expect(isStudyDay({ mon: 30 }, 20, "2026-10-13")).toBe(false);
    expect(weeklyMinutes(weekdaysOnly, 20)).toBe(155);
    expect(weeklyMinutes({ mon: 30 }, 20)).toBe(30);
  });

  it("ignores junk values in stored weeks", () => {
    const junk = { mon: -5, tue: Number.NaN, wed: "30" as unknown as number, thu: 9999 };
    expect(minutesForDay(junk, 20, "2026-10-12")).toBe(0);
    expect(minutesForDay(junk, 20, "2026-10-13")).toBe(0);
    expect(minutesForDay(junk, 20, "2026-10-14")).toBe(0);
    expect(minutesForDay(junk, 20, "2026-10-15")).toBe(240);
  });

  it("finds the next study day, wrapping into next week", () => {
    expect(nextStudyDay(weekdaysOnly, 20, "2026-10-12")).toBe("2026-10-13");
    expect(nextStudyDay(weekdaysOnly, 20, "2026-10-16")).toBe("2026-10-19");
    expect(nextStudyDay({ sat: 30 }, 20, "2026-10-17")).toBe("2026-10-24");
    expect(nextStudyDay({}, 20, "2026-10-12")).toBeNull();
    expect(nextStudyDay(null, 20, "2026-12-31")).toBe("2027-01-01");
  });

  it("reminds at 6pm unless a valid time is set", () => {
    expect(reminderHour(null)).toBe(18);
    expect(reminderHour(undefined)).toBe(18);
    expect(reminderHour("07:30")).toBe(7);
    expect(reminderHour("00:05")).toBe(0);
    expect(reminderHour("23:59")).toBe(23);
    for (const bad of ["", "7:30", "24:00", "12:60", "noon", "18:00:00"]) expect(reminderHour(bad)).toBe(18);
    expect(formatReminderTime("07:30")).toBe("7:30 AM");
    expect(formatReminderTime("12:00")).toBe("12:00 PM");
    expect(formatReminderTime("00:15")).toBe("12:15 AM");
    expect(formatReminderTime(null)).toBe("6:00 PM");
  });

  it("formats minutes and snaps legacy values to planner options", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(60)).toBe("1 hr");
    expect(formatMinutes(195)).toBe("3 hr 15 min");
    expect(formatMinutes(0)).toBe("0 min");
    expect(snapMinutes(10)).toBe(15);
    expect(snapMinutes(20)).toBe(20);
    expect(snapMinutes(90)).toBe(60);
  });

  it("picks the typical day and stores an even week as null", () => {
    expect(typicalMinutes(weekdaysOnly)).toBe(30);
    expect(typicalMinutes({ mon: 20, tue: 45 })).toBe(45);
    expect(typicalMinutes({ mon: 0 })).toBeNull();
    expect(normalizeStudyDays({ mon: 30, tue: 30, wed: 30, thu: 30, fri: 30, sat: 30, sun: 30 })).toBeNull();
    expect(normalizeStudyDays({ mon: 30, wed: 45 })).toEqual({ mon: 30, tue: 0, wed: 45, thu: 0, fri: 0, sat: 0, sun: 0 });
  });

  it("reads today's minutes in the student's time zone", () => {
    // 03:30 UTC on Tuesday Oct 13 is still Monday evening in Chicago.
    const now = new Date("2026-10-13T03:30:00Z");
    const profile = { studyDays: { mon: 45, tue: 0 } as StudyDays, dailyStudyMinutes: 20 };
    expect(minutesForToday(profile, "America/Chicago", now)).toBe(45);
    expect(minutesForToday(profile, "UTC", now)).toBe(0);
    expect(minutesForToday({ studyDays: null, dailyStudyMinutes: 30 }, "Asia/Tokyo", now)).toBe(30);
  });
});
