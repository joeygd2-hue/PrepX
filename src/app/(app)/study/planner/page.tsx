import type { Metadata } from "next";
import { requireUser } from "@/server/auth/session";
import { todayIn } from "@/lib/dates";
import { DEFAULT_REMINDER_TIME, REMINDER_TIME_RE, WEEKDAYS, minutesForWeekday, snapMinutes, weekdayOf } from "@/lib/planner";
import { BackHeader, Page } from "@/components/ui/page";
import { PlannerForm } from "./planner-form";

export const metadata: Metadata = { title: "Study planner" };

export default async function PlannerPage() {
  const user = await requireUser();
  const p = user.profile!;
  const days = WEEKDAYS.map((d) => minutesForWeekday(p.studyDays, p.dailyStudyMinutes, d));
  return (
    <Page>
      <BackHeader href="/study" title="Study planner" subtitle="Pick when you can study" />
      <PlannerForm
        initialDays={days.map((m) => (m > 0 ? snapMinutes(m) : 0))}
        typicalMinutes={snapMinutes(p.dailyStudyMinutes)}
        initialReminderTime={p.studyReminderTime && REMINDER_TIME_RE.test(p.studyReminderTime) ? p.studyReminderTime : DEFAULT_REMINDER_TIME}
        today={weekdayOf(todayIn(p.timezone))}
      />
    </Page>
  );
}
