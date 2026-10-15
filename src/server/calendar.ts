import "server-only";
import { and, asc, eq, gte, inArray, isNotNull, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { addDays, todayIn } from "@/lib/dates";
import { buildPlan } from "@/lib/plan";
import { planStats } from "./progress";
import { resolveTarget } from "./dashboard";

export type CalItem = {
  id: string;
  kind: "competition" | "milestone" | "target";
  start: string;
  end: string;
  title: string;
  org: "deca" | "fbla" | "hosa" | "tsa";
  level: string;
  status: "confirmed" | "tentative" | "unconfirmed";
  note?: string | null;
  location?: string | null;
  sourceUrl?: string | null;
};

/** Competitions the user has opted into plus personal plan milestones. */
export async function calendarItems(userId: string, tz: string): Promise<CalItem[]> {
  const prefs = await db.select().from(schema.orgPreferences).where(eq(schema.orgPreferences.userId, userId));
  const chapterRegions = await db
    .select({ org: schema.chapters.org, regionId: schema.chapters.regionId, state: schema.chapters.state })
    .from(schema.chapterMembers)
    .innerJoin(schema.chapters, eq(schema.chapters.id, schema.chapterMembers.chapterId))
    .where(and(eq(schema.chapterMembers.userId, userId), isNotNull(schema.chapters.regionId)));
  const shown = prefs.filter((p) => p.showDates);
  const from = addDays(todayIn(tz), -30);
  const items: CalItem[] = [];
  if (shown.length) {
    const conds = shown.map((p) => {
      const ch = chapterRegions.find((c) => c.org === p.org);
      const region = ch?.regionId ?? p.regionId;
      const state = ch?.state ?? p.state;
      return and(
        eq(schema.competitions.org, p.org),
        or(
          inArray(schema.competitions.level, ["international", "national"]),
          state ? and(eq(schema.competitions.level, "state"), eq(schema.competitions.state, state)) : undefined,
          region ? eq(schema.competitions.regionId, region) : undefined,
        ),
      );
    });
    const comps = await db
      .select()
      .from(schema.competitions)
      .where(and(gte(schema.competitions.endsOn, from), or(...conds)))
      .orderBy(asc(schema.competitions.startsOn));
    for (const c of comps)
      items.push({ id: c.id, kind: "competition", start: c.startsOn, end: c.endsOn, title: c.name, org: c.org, level: c.level, status: c.status, note: c.statusNote, location: c.location, sourceUrl: c.sourceUrl });
  }
  // Personal milestones for each active event.
  const sels = await db
    .select({ sel: schema.eventSelections, event: schema.events })
    .from(schema.eventSelections)
    .innerJoin(schema.events, eq(schema.events.id, schema.eventSelections.eventId))
    .where(and(eq(schema.eventSelections.userId, userId), eq(schema.eventSelections.active, true)));
  for (const { sel, event } of sels) {
    const target = await resolveTarget(userId, sel, tz);
    if (!target) continue;
    if (target.kind === "custom")
      items.push({ id: `target-${sel.id}`, kind: "target", start: target.startsOn, end: target.endsOn, title: `${event.code} competition (your date)`, org: sel.org, level: "personal", status: "confirmed" });
    const today = todayIn(tz);
    const { stats, shape } = await planStats(userId, event, tz);
    const daysLeft = Math.round((Date.parse(target.startsOn) - Date.parse(today)) / 86400000);
    const startedWith = Math.round((Date.parse(target.startsOn) - Date.parse(todayIn(tz, sel.selectedAt))) / 86400000);
    const plan = buildPlan(daysLeft, shape, stats, startedWith);
    for (const m of plan.milestones) {
      const d = addDays(today, m.dueInDays);
      items.push({ id: `ms-${sel.id}-${m.key}`, kind: "milestone", start: d, end: d, title: `${event.code}: ${m.heading}`, org: sel.org, level: "personal", status: "confirmed", note: m.criteria.map((c) => c.label).join(" · ") });
    }
  }
  return items.sort((a, b) => a.start.localeCompare(b.start));
}
