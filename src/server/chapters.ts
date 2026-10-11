import "server-only";
import { and, asc, desc, eq, gt, inArray, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { isJoinCodeShape, joinCode, normalizeJoinCode } from "@/lib/crypto";
import { rateLimit } from "./ratelimit";
import { awardXp, recordActivity } from "./progress";
import { XP } from "@/lib/levels";
import { notifyUsers } from "./notify";
import { leaderboardAliases } from "./alias";

export class ChapterError extends Error {}
type Role = "member" | "officer" | "advisor";
const RANK: Record<Role, number> = { member: 0, officer: 1, advisor: 2 };

export async function membership(userId: string, chapterId: string) {
  const [m] = await db.select().from(schema.chapterMembers).where(and(eq(schema.chapterMembers.chapterId, chapterId), eq(schema.chapterMembers.userId, userId)));
  return m ?? null;
}

/** Throws unless the user holds at least `min` in this chapter. Staff/admins are not implicitly members. */
export async function requireChapterRole(userId: string, chapterId: string, min: Role) {
  const m = await membership(userId, chapterId);
  if (!m || RANK[m.role] < RANK[min]) throw new ChapterError("You don't have permission to do that in this chapter.");
  return m;
}

async function uniqueCode() {
  for (let i = 0; i < 10; i++) {
    const code = joinCode();
    const [exists] = await db.select({ id: schema.chapters.id }).from(schema.chapters).where(eq(schema.chapters.joinCode, code));
    if (!exists) return code;
  }
  throw new Error("Could not allocate a join code");
}

export async function createChapter(userId: string, input: { org: "deca" | "fbla" | "hosa" | "tsa"; name: string; school: string; state?: string | null; regionId?: string | null }) {
  const [existing] = await db.select().from(schema.chapterMembers).where(and(eq(schema.chapterMembers.userId, userId), eq(schema.chapterMembers.org, input.org)));
  if (existing) throw new ChapterError(`You're already in a ${input.org.toUpperCase()} chapter. Leave it before starting a new one.`);
  if (!(await rateLimit(`chapter-create:${userId}`, 3, 86400))) throw new ChapterError("You've created several chapters today. Try again tomorrow.");
  return db.transaction(async (tx) => {
    const [c] = await tx
      .insert(schema.chapters)
      .values({ org: input.org, name: input.name, school: input.school, state: input.state ?? null, regionId: input.regionId ?? null, joinCode: await uniqueCode(), createdBy: userId })
      .returning();
    await tx.insert(schema.chapterMembers).values({ chapterId: c.id, userId, org: input.org, role: "advisor" });
    await tx.insert(schema.auditLog).values({ actorId: userId, action: "chapter.create", target: c.id, meta: { org: input.org } });
    return c;
  });
}

export async function joinChapter(userId: string, rawCode: string) {
  if (!(await rateLimit(`join:${userId}`, 10, 900))) throw new ChapterError("Too many attempts. Wait a few minutes and try again.");
  const code = normalizeJoinCode(rawCode);
  if (!isJoinCodeShape(code)) throw new ChapterError("Join codes are 6 letters and numbers, like ABC234.");
  const [c] = await db.select().from(schema.chapters).where(eq(schema.chapters.joinCode, code));
  if (!c || !c.joinEnabled) throw new ChapterError("That code doesn't match a chapter. Check it with your advisor.");
  if (c.joinCodeExpiresAt && c.joinCodeExpiresAt < new Date()) throw new ChapterError("That code has expired. Ask your advisor or a board member for a new one.");
  const [already] = await db
    .select({ chapterId: schema.chapterMembers.chapterId, name: schema.chapters.name })
    .from(schema.chapterMembers)
    .innerJoin(schema.chapters, eq(schema.chapters.id, schema.chapterMembers.chapterId))
    .where(and(eq(schema.chapterMembers.userId, userId), eq(schema.chapterMembers.org, c.org)));
  if (already?.chapterId === c.id) return c;
  if (already) throw new ChapterError(`You're already in ${already.name} for ${c.org.toUpperCase()}. You can be in one chapter per competition. Leave it first to switch.`);
  await db.insert(schema.chapterMembers).values({ chapterId: c.id, userId, org: c.org, role: "member" });
  return c;
}

export async function leaveChapter(userId: string, chapterId: string) {
  const m = await membership(userId, chapterId);
  if (!m) return;
  if (m.role === "advisor") {
    const [{ advisors }] = await db
      .select({ advisors: sql<number>`count(*)::int` })
      .from(schema.chapterMembers)
      .where(and(eq(schema.chapterMembers.chapterId, chapterId), eq(schema.chapterMembers.role, "advisor")));
    const [{ others }] = await db
      .select({ others: sql<number>`count(*)::int` })
      .from(schema.chapterMembers)
      .where(and(eq(schema.chapterMembers.chapterId, chapterId), ne(schema.chapterMembers.userId, userId)));
    if (advisors <= 1 && others > 0) throw new ChapterError("You're the only advisor. Make someone else an advisor before leaving.");
    if (others === 0) {
      await db.delete(schema.chapters).where(eq(schema.chapters.id, chapterId));
      return;
    }
  }
  await db.delete(schema.chapterMembers).where(and(eq(schema.chapterMembers.chapterId, chapterId), eq(schema.chapterMembers.userId, userId)));
}

export async function setMemberRole(actorId: string, chapterId: string, targetId: string, role: Role) {
  await requireChapterRole(actorId, chapterId, "advisor");
  const target = await membership(targetId, chapterId);
  if (!target) throw new ChapterError("Member not found.");
  if (target.role === "advisor" && role !== "advisor") {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.chapterMembers)
      .where(and(eq(schema.chapterMembers.chapterId, chapterId), eq(schema.chapterMembers.role, "advisor")));
    if (n <= 1) throw new ChapterError("A chapter needs at least one advisor.");
  }
  await db.update(schema.chapterMembers).set({ role }).where(and(eq(schema.chapterMembers.chapterId, chapterId), eq(schema.chapterMembers.userId, targetId)));
  await db.insert(schema.auditLog).values({ actorId, action: "chapter.role", target: chapterId, meta: { targetId, role } });
}

export async function removeMember(actorId: string, chapterId: string, targetId: string) {
  const actor = await requireChapterRole(actorId, chapterId, "officer");
  const target = await membership(targetId, chapterId);
  if (!target || targetId === actorId) throw new ChapterError("Member not found.");
  if (RANK[target.role] >= RANK[actor.role]) throw new ChapterError("Only an advisor can remove officers or advisors.");
  await db.delete(schema.chapterMembers).where(and(eq(schema.chapterMembers.chapterId, chapterId), eq(schema.chapterMembers.userId, targetId)));
  await db.insert(schema.auditLog).values({ actorId, action: "chapter.remove", target: chapterId, meta: { targetId } });
}

export async function updateJoinSettings(actorId: string, chapterId: string, opts: { regenerate?: boolean; expiresInDays?: number | null; enabled?: boolean }) {
  await requireChapterRole(actorId, chapterId, "advisor");
  const set: Partial<typeof schema.chapters.$inferInsert> = {};
  if (opts.regenerate) set.joinCode = await uniqueCode();
  if (opts.expiresInDays !== undefined) set.joinCodeExpiresAt = opts.expiresInDays ? new Date(Date.now() + opts.expiresInDays * 86400_000) : null;
  if (opts.enabled !== undefined) set.joinEnabled = opts.enabled;
  await db.update(schema.chapters).set(set).where(eq(schema.chapters.id, chapterId));
}

export async function postAnnouncement(actorId: string, chapterId: string, title: string, body: string) {
  await requireChapterRole(actorId, chapterId, "officer");
  if (!(await rateLimit(`announce:${chapterId}`, 20, 86400))) throw new ChapterError("That's a lot of announcements today. Try again tomorrow.");
  const [c] = await db.select().from(schema.chapters).where(eq(schema.chapters.id, chapterId));
  const [a] = await db.insert(schema.chapterAnnouncements).values({ chapterId, authorId: actorId, title, body }).returning();
  const members = await db.select({ userId: schema.chapterMembers.userId }).from(schema.chapterMembers).where(and(eq(schema.chapterMembers.chapterId, chapterId), ne(schema.chapterMembers.userId, actorId)));
  await notifyUsers(
    members.map((m) => m.userId),
    "chapterAnnouncements",
    { kind: "chapter_announcement", title: `${c.name}: ${title}`, body: body.slice(0, 140), href: "/chapter", dedupeKey: `ann:${a.id}` },
  );
  return a;
}

export async function openCheckin(actorId: string, chapterId: string, title: string, minutes: number, points: number) {
  await requireChapterRole(actorId, chapterId, "officer");
  const [c] = await db.select().from(schema.chapters).where(eq(schema.chapters.id, chapterId));
  const [ck] = await db.insert(schema.checkins).values({ chapterId, title, points, openedBy: actorId, closesAt: new Date(Date.now() + minutes * 60_000) }).returning();
  const members = await db.select({ userId: schema.chapterMembers.userId }).from(schema.chapterMembers).where(eq(schema.chapterMembers.chapterId, chapterId));
  await notifyUsers(members.map((m) => m.userId).filter((u) => u !== actorId), "checkinOpen", { kind: "checkin", title: `Check-in is open: ${title}`, body: `${c.name} · closes in ${minutes} min`, href: "/chapter", dedupeKey: `ck:${ck.id}` });
  return ck;
}

export async function closeCheckin(actorId: string, checkinId: string) {
  const [ck] = await db.select().from(schema.checkins).where(eq(schema.checkins.id, checkinId));
  if (!ck) return;
  await requireChapterRole(actorId, ck.chapterId, "officer");
  await db.update(schema.checkins).set({ closesAt: new Date() }).where(eq(schema.checkins.id, checkinId));
}

export async function checkIn(userId: string, checkinId: string, tz: string) {
  const [ck] = await db.select().from(schema.checkins).where(and(eq(schema.checkins.id, checkinId), gt(schema.checkins.closesAt, new Date())));
  if (!ck) throw new ChapterError("This check-in is closed.");
  if (!(await membership(userId, ck.chapterId))) throw new ChapterError("You're not in this chapter.");
  const inserted = await db.insert(schema.checkinRecords).values({ checkinId, userId }).onConflictDoNothing().returning();
  if (inserted.length) {
    await db
      .update(schema.chapterMembers)
      .set({ points: sql`${schema.chapterMembers.points} + ${ck.points}` })
      .where(and(eq(schema.chapterMembers.chapterId, ck.chapterId), eq(schema.chapterMembers.userId, userId)));
    await awardXp(userId, XP.checkin, "checkin", ck.id);
    await recordActivity(userId, tz);
  }
}

/**
 * Roster for a member. Everyone sees display names and roles (never emails or school info).
 * Officers and advisors also see every member's name and points and, only for members who
 * allow it, weekly study activity. A regular member sees their own points; on the leaderboard
 * they also see members who turned leaderboards on, by display name or by leaderboard alias.
 */
export async function roster(viewerId: string, chapterId: string) {
  const viewer = await membership(viewerId, chapterId);
  if (!viewer) throw new ChapterError("You're not in this chapter.");
  const lead = RANK[viewer.role] >= RANK.officer;
  const rows = await db
    .select({
      userId: schema.chapterMembers.userId,
      role: schema.chapterMembers.role,
      points: schema.chapterMembers.points,
      joinedAt: schema.chapterMembers.joinedAt,
      displayName: schema.profiles.displayName,
      firstName: schema.profiles.firstName,
      lastName: schema.profiles.lastName,
      share: schema.profiles.shareActivityWithChapter,
      visibility: schema.profiles.leaderboardVisibility,
    })
    .from(schema.chapterMembers)
    .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.chapterMembers.userId))
    .where(eq(schema.chapterMembers.chapterId, chapterId))
    .orderBy(desc(schema.chapterMembers.role), asc(schema.profiles.firstName));
  const ids = lead ? rows.filter((r) => r.share).map((r) => r.userId) : [];
  const weekAgo = new Date(Date.now() - 7 * 86400_000);
  const activity = ids.length
    ? await db
        .select({ userId: schema.attemptAnswers.userId, n: sql<number>`count(*)::int` })
        .from(schema.attemptAnswers)
        .where(and(inArray(schema.attemptAnswers.userId, ids), gt(schema.attemptAnswers.answeredAt, weekAgo)))
        .groupBy(schema.attemptAnswers.userId)
    : [];
  const act = new Map(activity.map((a) => [a.userId, a.n]));
  const nameFor = (r: (typeof rows)[number]) => (lead ? `${r.firstName} ${r.lastName}`.trim() || r.displayName : r.displayName || r.firstName);

  // Leaders rank everyone by name. Members see only people who opted into leaderboards, under the
  // name they chose to show there; a nickname row never carries the member's real name or id.
  const aliases = lead ? new Map<string, string>() : await leaderboardAliases(rows.filter((r) => r.visibility === "pseudonym").map((r) => r.userId));
  const entries = rows
    .flatMap((r) => {
      const name = lead || r.visibility === "name" ? nameFor(r) : r.visibility === "pseudonym" ? aliases.get(r.userId) : undefined;
      return name ? [{ name, points: r.points, you: r.userId === viewerId }] : [];
    })
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  let rank = 0;
  const leaderboard = entries.map((e, i) => {
    if (i === 0 || e.points < entries[i - 1].points) rank = i + 1;
    return { rank, ...e };
  });
  const self = rows.find((r) => r.userId === viewerId);

  return {
    viewerRole: viewer.role,
    /** Whether the viewer opted into leaderboards, so other members can see their points. */
    onLeaderboard: self?.visibility === "name" || self?.visibility === "pseudonym",
    members: rows.map((r) => ({
      userId: r.userId,
      role: r.role,
      name: nameFor(r),
      points: lead || r.userId === viewerId ? r.points : null,
      questionsThisWeek: lead && r.share ? (act.get(r.userId) ?? 0) : null,
    })),
    leaderboard,
  };
}
