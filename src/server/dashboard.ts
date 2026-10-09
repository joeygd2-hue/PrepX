import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { daysUntil, todayIn, daysBetween } from "@/lib/dates";
import { buildPlan, dailyTasks } from "@/lib/plan";
import { XP } from "@/lib/levels";
import { activeSelection, awardXp, openMistakes, planStats, unitMastery } from "./progress";

export type Target = {
  kind: "competition" | "custom";
  name: string;
  shortName: string;
  startsOn: string;
  endsOn: string;
  location: string | null;
  status: "confirmed" | "tentative" | "unconfirmed";
  statusNote: string | null;
  sourceUrl: string | null;
  competitionId: string | null;
  dateChanged: boolean;
  org: string;
};

/** The competition (or custom date) a selection is counting down to. */
export async function resolveTarget(userId: string, sel: typeof schema.eventSelections.$inferSelect, tz: string): Promise<Target | null> {
  if (sel.targetDate) {
    return { kind: "custom", name: "Your target date", shortName: "your competition", startsOn: sel.targetDate, endsOn: sel.targetDate, location: null, status: "confirmed", statusNote: "Date you entered", sourceUrl: null, competitionId: null, dateChanged: false, org: sel.org };
  }
  let comp: typeof schema.competitions.$inferSelect | undefined;
  if (sel.competitionId) [comp] = await db.select().from(schema.competitions).where(eq(schema.competitions.id, sel.competitionId));
  if (!comp) {
    const [pref] = await db.select().from(schema.orgPreferences).where(and(eq(schema.orgPreferences.userId, userId), eq(schema.orgPreferences.org, sel.org)));
    const today = todayIn(tz);
    const candidates = await db
      .select()
      .from(schema.competitions)
      .where(
        and(
          eq(schema.competitions.org, sel.org),
          gte(schema.competitions.endsOn, today),
          or(
            inArray(schema.competitions.level, ["international", "national"]),
            pref?.regionId ? eq(schema.competitions.regionId, pref.regionId) : sql`false`,
            pref?.state ? and(eq(schema.competitions.level, "state"), eq(schema.competitions.state, pref.state)) : sql`false`,
          ),
        ),
      )
      .orderBy(asc(schema.competitions.startsOn));
    comp = candidates[0];
  }
  if (!comp) return null;
  const changedRecently = Boolean(comp.dateChangedAt && Date.now() - comp.dateChangedAt.getTime() < 60 * 86400_000);
  return {
    kind: "competition",
    name: comp.name,
    shortName: comp.shortName,
    startsOn: comp.startsOn,
    endsOn: comp.endsOn,
    location: comp.location,
    status: comp.status,
    statusNote: comp.statusNote,
    sourceUrl: comp.sourceUrl,
    competitionId: comp.id,
    dateChanged: changedRecently,
    org: comp.org,
  };
}

export async function studyContext(userId: string, tz: string, minutesPerDay: number, org?: "deca" | "fbla" | "hosa" | "tsa" | null) {
  const selection = await activeSelection(userId, org);
  if (!selection) return null;
  const { sel, event } = selection;
  const target = await resolveTarget(userId, sel, tz);
  const daysLeft = target ? daysUntil(target.startsOn, tz) : null;
  const { stats, shape } = await planStats(userId, event, tz);
  const plan = buildPlan(daysLeft, shape, stats);
  const clusterId = event.components.exam?.clusterId;
  const cluster = clusterId ? (await db.select().from(schema.examClusters).where(eq(schema.examClusters.id, clusterId)))[0] : undefined;
  const tasks = await ensureTodayTasks(userId, event, tz, {
    daysLeft,
    minutesPerDay,
    examClusterId: clusterId,
    examLabel: cluster?.name,
    shape,
    competitionName: target?.shortName ?? null,
  });
  return { sel, event, target, daysLeft, stats, shape, plan, cluster: cluster ?? null, tasks };
}

async function ensureTodayTasks(
  userId: string,
  event: typeof schema.events.$inferSelect,
  tz: string,
  o: { daysLeft: number | null; minutesPerDay: number; examClusterId?: string; examLabel?: string; shape: ReturnType<typeof import("@/lib/plan").eventShape>; competitionName: string | null },
) {
  const day = todayIn(tz);
  const existing = await db
    .select()
    .from(schema.planTasks)
    .where(and(eq(schema.planTasks.userId, userId), eq(schema.planTasks.eventId, event.id), eq(schema.planTasks.day, day)))
    .orderBy(asc(schema.planTasks.position));
  const gen = dailyTasks({
    eventCode: event.code,
    eventName: event.name,
    examLabel: o.examLabel,
    examClusterId: o.examClusterId,
    shape: o.shape,
    daysLeft: o.daysLeft,
    minutesPerDay: o.minutesPerDay,
    nextUnit: o.examClusterId ? ((await unitMastery(userId, o.examClusterId)).find((u) => !u.lessonDone)?.unit ?? null) : null,
    mistakesOpen: o.examClusterId ? await openMistakes(userId, o.examClusterId) : 0,
    dayIndex: daysBetween("2026-01-01", day),
    competitionName: o.competitionName,
  });
  if (existing.length) return { headline: gen.headline, tasks: existing };
  const rows = gen.tasks.map((t, i) => ({ userId, eventId: event.id, day, position: i, ...t }));
  if (rows.length) await db.insert(schema.planTasks).values(rows);
  const inserted = await db
    .select()
    .from(schema.planTasks)
    .where(and(eq(schema.planTasks.userId, userId), eq(schema.planTasks.eventId, event.id), eq(schema.planTasks.day, day)))
    .orderBy(asc(schema.planTasks.position));
  return { headline: gen.headline, tasks: inserted };
}

/**
 * Called by activity handlers after the server has recorded real work. Completes today's
 * matching plan task (if any) and awards plan XP once.
 */
export async function autoCompleteTask(userId: string, tz: string, kinds: string[]) {
  const day = todayIn(tz);
  const done = await db
    .update(schema.planTasks)
    .set({ completedAt: new Date() })
    .where(and(eq(schema.planTasks.userId, userId), eq(schema.planTasks.day, day), inArray(schema.planTasks.kind, kinds), isNull(schema.planTasks.completedAt)))
    .returning({ id: schema.planTasks.id });
  for (const t of done) await awardXp(userId, XP.planTask, "plan_task", t.id);
}

export async function homeAnnouncements(userId: string, orgs: string[]) {
  const rows = await db
    .select()
    .from(schema.announcements)
    .where(
      and(
        or(isNull(schema.announcements.org), orgs.length ? inArray(schema.announcements.org, orgs as ("deca" | "fbla" | "hosa" | "tsa")[]) : sql`false`),
        or(isNull(schema.announcements.expiresAt), gte(schema.announcements.expiresAt, new Date())),
        sql`not exists (select 1 from announcement_dismissals d where d.announcement_id = ${schema.announcements.id} and d.user_id = ${userId})`,
      ),
    )
    .orderBy(desc(schema.announcements.publishedAt))
    .limit(3);
  return rows;
}

export async function unreadNotifications(userId: string) {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.notifications)
    .where(and(eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt)));
  return n;
}
