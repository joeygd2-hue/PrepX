import type { Metadata } from "next";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { activeSelection } from "@/server/progress";
import { todayIn } from "@/lib/dates";
import { minutesForToday } from "@/lib/planner";
import type { OrgId } from "@/lib/orgs";
import { FocusTimer } from "./focus-timer";

export const metadata: Metadata = { title: "Focus" };

export default async function FocusPage() {
  const user = await requireUser();
  const p = user.profile!;
  // Read-only: today's plan is created on Home/Study (one per event); here we only point at the next
  // open task of the event Study shows (falling back to Home's), so two events' tasks never mix.
  const org = (p.focusOrg ?? p.orgInterests[0] ?? "deca") as OrgId;
  const selection = (await activeSelection(user.id, org)) ?? (await activeSelection(user.id));
  const tasks = selection
    ? await db
        .select({ id: schema.planTasks.id, title: schema.planTasks.title, minutes: schema.planTasks.minutes, href: schema.planTasks.href, completedAt: schema.planTasks.completedAt })
        .from(schema.planTasks)
        .where(and(eq(schema.planTasks.userId, user.id), eq(schema.planTasks.eventId, selection.event.id), eq(schema.planTasks.day, todayIn(p.timezone))))
        .orderBy(asc(schema.planTasks.position))
    : [];
  const internal = (href: string) => href.startsWith("/") && !href.startsWith("//") && !href.startsWith("/\\");
  const next = tasks.find((t) => !t.completedAt && internal(t.href));
  return (
    <FocusTimer
      task={next ? { title: next.title, minutes: next.minutes, href: next.href } : null}
      planDone={tasks.length > 0 && tasks.every((t) => t.completedAt)}
      todayMinutes={minutesForToday(p, p.timezone)}
    />
  );
}
