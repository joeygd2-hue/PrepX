import { describe, expect, it } from "vitest";
import { addDays, daysBetween, daysUntil, formatRange, greetingFor, seasonKey, todayIn } from "@/lib/dates";

describe("countdown", () => {
  it("matches the reference app: 190 days from Oct 9, 2026 to ICDC (Apr 17, 2027)", () => {
    const now = new Date("2026-10-09T19:00:00Z");
    expect(daysUntil("2027-04-17", "America/Chicago", now)).toBe(190);
  });

  it("uses the viewer's local calendar day, not UTC", () => {
    // 03:30 UTC on Oct 10 is still Oct 9 in Chicago.
    const now = new Date("2026-10-10T03:30:00Z");
    expect(todayIn("America/Chicago", now)).toBe("2026-10-09");
    expect(todayIn("UTC", now)).toBe("2026-10-10");
    expect(daysUntil("2026-10-12", "America/Chicago", now)).toBe(3);
    expect(daysUntil("2026-10-12", "UTC", now)).toBe(2);
  });

  it("handles DST transitions without off-by-one errors", () => {
    expect(daysBetween("2026-11-01", "2026-11-02")).toBe(1);
    expect(daysBetween("2027-03-13", "2027-03-15")).toBe(2);
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2027-03-01", -1)).toBe("2027-02-28");
  });

  it("formats ranges like the reference card", () => {
    expect(formatRange("2027-04-17", "2027-04-20")).toBe("Sat, Apr 17 – Tue, Apr 20");
  });

  it("computes the Aug 1 – Jul 31 competition season", () => {
    expect(seasonKey("2026-10-09")).toBe("2026-2027");
    expect(seasonKey("2027-07-31")).toBe("2026-2027");
    expect(seasonKey("2027-08-01")).toBe("2027-2028");
  });
});

describe("greetingFor", () => {
  it("uses the viewer's local hour, not the server's", () => {
    const t = new Date("2026-10-10T15:30:00Z");
    expect(greetingFor("UTC", t)).toBe("Good afternoon");
    expect(greetingFor("America/Los_Angeles", t)).toBe("Good morning"); // 08:30
    expect(greetingFor("Asia/Tokyo", t)).toBe("Up late"); // 00:30
    expect(greetingFor("Europe/Berlin", t)).toBe("Good evening"); // 17:30
  });
});
