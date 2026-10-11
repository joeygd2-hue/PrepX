import { describe, expect, it } from "vitest";
import { currentStreak, longestStreak } from "@/lib/streaks";
import { levelFor } from "@/lib/levels";
import { earnedAchievements } from "@/lib/achievements";
import { buildIcs, googleCalendarUrl } from "@/lib/ics";
import { randomAlias } from "@/lib/alias";
import { skillBanksFor, studyBankFor } from "@/lib/banks";
import { isJoinCodeShape, joinCode, normalizeJoinCode, sixDigitCode } from "@/lib/crypto";
import { ageOn } from "@/lib/age";

describe("streaks", () => {
  it("counts consecutive days ending today or yesterday", () => {
    expect(currentStreak(["2026-10-07", "2026-10-08", "2026-10-09"], "2026-10-09")).toBe(3);
    expect(currentStreak(["2026-10-07", "2026-10-08"], "2026-10-09")).toBe(2);
    expect(currentStreak(["2026-10-06"], "2026-10-09")).toBe(0);
    expect(longestStreak(["2026-01-01", "2026-01-02", "2026-01-05", "2026-01-06", "2026-01-07"])).toBe(3);
  });
});

describe("levels", () => {
  it("matches the reference: 0 XP is Rookie, 500 to Competitor", () => {
    const l = levelFor(0);
    expect(l).toMatchObject({ level: 1, name: "Rookie", toNext: 500 });
    expect(l.next?.name).toBe("Competitor");
    expect(levelFor(7000).name).toBe("Legend");
  });
});

describe("achievements", () => {
  it("unlocks streak badges by threshold", () => {
    const base = { questionsAnswered: 0, lessonsCompleted: 0, judgeRuns: 0, examsSubmitted: 0, planComplete: false, referralsActive: 0 };
    expect(earnedAchievements({ ...base, longestStreak: 7 })).toEqual(["warming-up", "one-week-streak"]);
  });
});

describe("calendar export", () => {
  it("produces a valid all-day ICS event with an exclusive end date", () => {
    const ics = buildIcs([{ uid: "deca-icdc-2027", title: "DECA ICDC, Anaheim", start: "2027-04-17", end: "2027-04-20", location: "Anaheim, CA" }]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("DTSTART;VALUE=DATE:20270417");
    expect(ics).toContain("DTEND;VALUE=DATE:20270421");
    expect(ics).toContain("SUMMARY:DECA ICDC\\, Anaheim");
    expect(ics.split("\r\n").every((l) => l.length <= 75)).toBe(true);
  });
  it("builds a Google Calendar template link", () => {
    const u = new URL(googleCalendarUrl({ uid: "x", title: "T", start: "2027-04-17", end: "2027-04-20" }));
    expect(u.searchParams.get("dates")).toBe("20270417/20270421");
  });
});

describe("codes", () => {
  it("generates unambiguous 6-character join codes", () => {
    for (let i = 0; i < 200; i++) {
      const c = joinCode();
      expect(isJoinCodeShape(c)).toBe(true);
      expect(c).not.toMatch(/[01OIL]/);
    }
    expect(normalizeJoinCode(" abc-234 ")).toBe("ABC234");
    expect(isJoinCodeShape("ABC23")).toBe(false);
    expect(sixDigitCode()).toMatch(/^\d{6}$/);
  });
});

describe("age gate", () => {
  it("computes age correctly around birthdays", () => {
    expect(ageOn("2013-10-10", "2026-10-09")).toBe(12);
    expect(ageOn("2013-10-09", "2026-10-09")).toBe(13);
  });
});

describe("randomAlias", () => {
  it("is an adjective, an animal and a two-digit number", () => {
    for (let i = 0; i < 50; i++) expect(randomAlias()).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+ [1-9]\d$/);
  });
});

describe("study banks", () => {
  it("uses the official test bank first, then the knowledge bank", () => {
    expect(studyBankFor({ exam: { clusterId: "deca-mkt", label: "Marketing exam" }, roleplay: {} })).toEqual({ id: "deca-mkt", official: true, label: "Marketing exam" });
    expect(studyBankFor({ knowledge: { clusterId: "tsa-computing", label: "Computing and coding" }, production: { label: "Project" } })).toEqual({ id: "tsa-computing", official: false, label: "Computing and coding" });
    expect(studyBankFor({ presentation: { label: "Talk" } })).toBeNull();
  });
  it("maps each event component to a skills bank once, in order", () => {
    expect(skillBanksFor({ exam: { clusterId: "x", label: "x" }, roleplay: {}, spelldown: true })).toEqual(["skills-roleplay", "skills-test"]);
    expect(skillBanksFor({ written: { label: "Plan" }, presentation: { label: "Pitch" } })).toEqual(["skills-presentation", "skills-written"]);
    expect(skillBanksFor({ spelldown: false })).toEqual([]);
  });
});
