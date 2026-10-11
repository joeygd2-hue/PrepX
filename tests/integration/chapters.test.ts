import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ChapterError, checkIn, createChapter, joinChapter, leaveChapter, openCheckin, postAnnouncement, removeMember, roster, setMemberRole, updateJoinSettings } from "@/server/chapters";
import { createGame, advanceGame, answerGame, gameState } from "@/server/quiz";
import { makeUser } from "../support/factory";

const TZ = "America/Chicago";

describe("chapters", () => {
  it("joins with a valid code (case/spacing tolerant) and rejects invalid ones", async () => {
    const adv = await makeUser({ first: "Ada" });
    const c = await createChapter(adv.id, { org: "deca", name: "Lakeside DECA", school: "Lakeside HS" });
    expect(c.joinCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    const s = await makeUser();
    await expect(joinChapter(s.id, "abc")).rejects.toThrow(/6 letters/);
    await expect(joinChapter(s.id, "ZZZZZ9")).rejects.toThrow(/doesn't match/);
    await joinChapter(s.id, ` ${c.joinCode.toLowerCase().slice(0, 3)}-${c.joinCode.slice(3)} `);
    const [m] = await db.select().from(schema.chapterMembers).where(and(eq(schema.chapterMembers.chapterId, c.id), eq(schema.chapterMembers.userId, s.id)));
    expect(m.role).toBe("member");
  });

  it("enforces one chapter per organization but allows one per different org", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const deca1 = await createChapter(a.id, { org: "deca", name: "One", school: "S" });
    const fbla = await createChapter(a.id, { org: "fbla", name: "FBLA", school: "S" });
    const deca2 = await createChapter(b.id, { org: "deca", name: "Two", school: "T" });
    const s = await makeUser();
    await joinChapter(s.id, deca1.joinCode);
    await joinChapter(s.id, fbla.joinCode);
    await expect(joinChapter(s.id, deca2.joinCode)).rejects.toThrow(/one chapter per competition/);
  });

  it("rejects expired and disabled codes", async () => {
    const a = await makeUser();
    const c = await createChapter(a.id, { org: "hosa", name: "H", school: "S" });
    await db.update(schema.chapters).set({ joinCodeExpiresAt: new Date(Date.now() - 1000) }).where(eq(schema.chapters.id, c.id));
    const s = await makeUser();
    await expect(joinChapter(s.id, c.joinCode)).rejects.toThrow(/expired/);
    await updateJoinSettings(a.id, c.id, { expiresInDays: null, enabled: false });
    await expect(joinChapter(s.id, c.joinCode)).rejects.toThrow(/doesn't match/);
  });

  it("enforces role permissions on the server", async () => {
    const adv = await makeUser();
    const c = await createChapter(adv.id, { org: "tsa", name: "TSA", school: "S" });
    const m1 = await makeUser();
    const m2 = await makeUser();
    await joinChapter(m1.id, c.joinCode);
    await joinChapter(m2.id, c.joinCode);
    // Members cannot manage
    await expect(postAnnouncement(m1.id, c.id, "Hi", "x")).rejects.toBeInstanceOf(ChapterError);
    await expect(openCheckin(m1.id, c.id, "Mtg", 30, 10)).rejects.toBeInstanceOf(ChapterError);
    await expect(updateJoinSettings(m1.id, c.id, { regenerate: true })).rejects.toBeInstanceOf(ChapterError);
    await expect(setMemberRole(m1.id, c.id, m1.id, "advisor")).rejects.toBeInstanceOf(ChapterError);
    await expect(removeMember(m1.id, c.id, m2.id)).rejects.toBeInstanceOf(ChapterError);
    // Officers can post and remove members, but not other officers or the advisor
    await setMemberRole(adv.id, c.id, m1.id, "officer");
    await postAnnouncement(m1.id, c.id, "Meeting", "Thursday");
    await expect(removeMember(m1.id, c.id, adv.id)).rejects.toThrow(/Only an advisor/);
    await expect(setMemberRole(m1.id, c.id, m2.id, "officer")).rejects.toBeInstanceOf(ChapterError);
    await removeMember(m1.id, c.id, m2.id);
    // Last advisor protection
    await expect(setMemberRole(adv.id, c.id, adv.id, "member")).rejects.toThrow(/at least one advisor/);
    await expect(leaveChapter(adv.id, c.id)).rejects.toThrow(/only advisor/);
    // Non-members cannot see the roster
    const outsider = await makeUser();
    await expect(roster(outsider.id, c.id)).rejects.toBeInstanceOf(ChapterError);
  });

  it("hides study activity from leaders unless the member shares it, and never exposes emails", async () => {
    const adv = await makeUser();
    const c = await createChapter(adv.id, { org: "deca", name: "Privacy", school: "S" });
    const m = await makeUser({ first: "Priya" });
    await joinChapter(m.id, c.joinCode);
    // Sharing is off unless the member turns it on.
    const [p] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, m.id));
    expect(p.shareActivityWithChapter).toBe(false);
    const r = await roster(adv.id, c.id);
    const row = r.members.find((x) => x.userId === m.id)!;
    expect(row.questionsThisWeek).toBeNull();
    expect(JSON.stringify(r)).not.toContain("@prepx.test");
    // Once the member opts in, leaders see the weekly count; members never do.
    await db.update(schema.profiles).set({ shareActivityWithChapter: true }).where(eq(schema.profiles.userId, m.id));
    expect((await roster(adv.id, c.id)).members.find((x) => x.userId === m.id)!.questionsThisWeek).toBe(0);
    const asMember = await roster(m.id, c.id);
    expect(asMember.members.every((x) => x.questionsThisWeek === null)).toBe(true);
  });

  it("shows members only their own points and the points of members who opted into leaderboards", async () => {
    const adv = await makeUser({ first: "Avery" });
    const c = await createChapter(adv.id, { org: "deca", name: "Board", school: "S" });
    const viewer = await makeUser({ first: "Vic" });
    const named = await makeUser({ first: "Nia" });
    const nick = await makeUser({ first: "Pat" });
    const hidden = await makeUser({ first: "Hal" });
    for (const u of [viewer, named, nick, hidden]) await joinChapter(u.id, c.joinCode);
    const points = new Map([
      [adv.id, 5],
      [viewer.id, 20],
      [named.id, 30],
      [nick.id, 40],
      [hidden.id, 50],
    ]);
    for (const [userId, pts] of points)
      await db.update(schema.chapterMembers).set({ points: pts }).where(and(eq(schema.chapterMembers.chapterId, c.id), eq(schema.chapterMembers.userId, userId)));
    await db.update(schema.profiles).set({ leaderboardVisibility: "name" }).where(eq(schema.profiles.userId, named.id));
    await db.update(schema.profiles).set({ leaderboardVisibility: "pseudonym" }).where(eq(schema.profiles.userId, nick.id));

    // A member who hasn't opted in sees their own points but isn't ranked; hidden members are left out entirely.
    const r = await roster(viewer.id, c.id);
    expect(r.onLeaderboard).toBe(false);
    expect(r.members.find((x) => x.userId === viewer.id)!.points).toBe(20);
    expect(r.members.filter((x) => x.userId !== viewer.id).every((x) => x.points === null)).toBe(true);
    const [alias] = await db.select({ alias: schema.profiles.leaderboardAlias }).from(schema.profiles).where(eq(schema.profiles.userId, nick.id));
    expect(alias.alias).toBeTruthy();
    expect(alias.alias).not.toContain("Pat");
    expect(r.leaderboard).toEqual([
      { rank: 1, name: alias.alias, points: 40, you: false },
      { rank: 2, name: "Nia", points: 30, you: false },
    ]);

    // After opting in, the viewer is ranked and marked as themselves. Ties share a rank.
    await db.update(schema.profiles).set({ leaderboardVisibility: "name" }).where(eq(schema.profiles.userId, viewer.id));
    await db.update(schema.chapterMembers).set({ points: 30 }).where(and(eq(schema.chapterMembers.chapterId, c.id), eq(schema.chapterMembers.userId, viewer.id)));
    const after = await roster(viewer.id, c.id);
    expect(after.onLeaderboard).toBe(true);
    expect(after.leaderboard.map((e) => [e.rank, e.name, e.you])).toEqual([
      [1, alias.alias, false],
      [2, "Nia", false],
      [2, "Vic", true],
    ]);
    // The alias stays the same across visits.
    expect((await roster(named.id, c.id)).leaderboard[0].name).toBe(alias.alias);

    // Leaders keep seeing every member's full name and points.
    const lead = await roster(adv.id, c.id);
    expect(lead.members.every((x) => x.points !== null)).toBe(true);
    expect(lead.leaderboard.map((e) => [e.rank, e.name, e.points, e.you])).toEqual([
      [1, "Hal Student", 50, false],
      [2, "Pat Student", 40, false],
      [3, "Nia Student", 30, false],
      [3, "Vic Student", 30, false],
      [5, "Avery Student", 5, true],
    ]);
  });

  it("check-ins award points once and only while open", async () => {
    const adv = await makeUser();
    const c = await createChapter(adv.id, { org: "fbla", name: "CK", school: "S" });
    const m = await makeUser();
    await joinChapter(m.id, c.joinCode);
    const ck = await openCheckin(adv.id, c.id, "General meeting", 30, 10);
    await checkIn(m.id, ck.id, TZ);
    await checkIn(m.id, ck.id, TZ);
    const [row] = await db.select().from(schema.chapterMembers).where(and(eq(schema.chapterMembers.chapterId, c.id), eq(schema.chapterMembers.userId, m.id)));
    expect(row.points).toBe(10);
    const notif = await db.select().from(schema.notifications).where(and(eq(schema.notifications.userId, m.id), eq(schema.notifications.kind, "checkin")));
    expect(notif).toHaveLength(1);
    await db.update(schema.checkins).set({ closesAt: new Date(Date.now() - 1000) }).where(eq(schema.checkins.id, ck.id));
    const late = await makeUser();
    await joinChapter(late.id, c.joinCode);
    await expect(checkIn(late.id, ck.id, TZ)).rejects.toThrow(/closed/);
  });

  it("runs a quiz night: only hosts advance, answers score once, points go to the chapter", async () => {
    const adv = await makeUser();
    const c = await createChapter(adv.id, { org: "deca", name: "Quiz", school: "S" });
    const m = await makeUser();
    await joinChapter(m.id, c.joinCode);
    await expect(createGame(m.id, c.id, "deca-bac")).rejects.toBeInstanceOf(ChapterError);
    const g = await createGame(adv.id, c.id, "deca-bac", 3, 20);
    await expect(advanceGame(m.id, g.id)).rejects.toThrow(/Only the host/);
    await advanceGame(adv.id, g.id); // question 0 live
    const s0 = await gameState(m.id, g.id);
    expect(s0.status).toBe("live");
    expect(s0.question?.answerIndex).toBeUndefined();
    const [q] = await db.select().from(schema.questions).where(eq(schema.questions.id, g.questionIds[0]));
    await answerGame(m.id, g.id, 0, q.answerIndex);
    await advanceGame(adv.id, g.id); // reveal
    const s1 = await gameState(m.id, g.id);
    expect(s1.myAnswer?.correct).toBe(true);
    expect(s1.question?.answerIndex).toBe(q.answerIndex);
    for (let i = 0; i < 10 && (await gameState(adv.id, g.id)).status !== "ended"; i++) await advanceGame(adv.id, g.id);
    expect((await gameState(m.id, g.id)).status).toBe("ended");
    const [row] = await db.select().from(schema.chapterMembers).where(and(eq(schema.chapterMembers.chapterId, c.id), eq(schema.chapterMembers.userId, m.id)));
    expect(row.points).toBe(1);
  });
});
