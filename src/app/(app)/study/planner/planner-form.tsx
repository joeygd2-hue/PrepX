"use client";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { savePlanner, type PlannerResult } from "@/app/actions/planner";
import { Card, HeroTexture, SectionLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Notice, Select } from "@/components/ui/form";
import { MINUTE_OPTIONS, REMINDER_TIME_RE, WEEKDAYS, WEEKDAY_NAMES, formatMinutes, formatReminderTime, reminderHour, type Weekday } from "@/lib/planner";
import { cn } from "@/lib/cn";

export function PlannerForm(props: { initialDays: number[]; typicalMinutes: number; initialReminderTime: string; today: Weekday }) {
  const { today } = props;
  const [on, setOn] = useState(() => props.initialDays.map((m) => m > 0));
  // Minutes are remembered for rest days too, so switching a day back on restores its length.
  const [mins, setMins] = useState(() => props.initialDays.map((m) => (m > 0 ? m : props.typicalMinutes)));
  const [time, setTime] = useState(props.initialReminderTime);
  const [result, setResult] = useState<PlannerResult | null>(null);
  const [pending, start] = useTransition();

  const minutesAt = (i: number) => (on[i] ? mins[i] : 0);
  const total = WEEKDAYS.reduce((sum, _, i) => sum + minutesAt(i), 0);
  const activeCount = on.filter(Boolean).length;
  const todayIndex = WEEKDAYS.indexOf(today);
  const todayMinutes = minutesAt(todayIndex);
  const nextIndex = [1, 2, 3, 4, 5, 6, 7].map((k) => (todayIndex + k) % 7).find((i) => on[i]);
  const timeValid = REMINDER_TIME_RE.test(time);
  const hour = String(reminderHour(time)).padStart(2, "0");

  const toggle = (i: number) => {
    setOn((prev) => prev.map((v, j) => (j === i ? !v : v)));
    setResult(null);
  };
  const setMinutes = (i: number, m: number) => {
    setMins((prev) => prev.map((v, j) => (j === i ? m : v)));
    setResult(null);
  };
  const save = () => {
    start(async () => {
      setResult(await savePlanner({ days: WEEKDAYS.map((_, i) => minutesAt(i)), reminderTime: timeValid ? time : null }));
    });
  };

  return (
    <div>
      <Card tone="inverse" className="rounded-[28px]">
        <HeroTexture />
        <div className="relative">
          <p className="eyebrow !text-hero-muted">Preview · {WEEKDAY_NAMES[today].long}</p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.02em]" aria-live="polite">
            {todayMinutes ? `Today: ${todayMinutes} min` : "Today is a rest day"}
          </p>
          <p className="mt-1 text-sm text-hero-muted">
            {todayMinutes
              ? "We'll size today's plan to fit."
              : nextIndex !== undefined
                ? `Next study day: ${WEEKDAY_NAMES[WEEKDAYS[nextIndex]].long}`
                : "Pick at least one study day."}
          </p>
          <div className="mt-5 flex items-end justify-between gap-4 border-t border-hero-line pt-4">
            <p className="text-sm text-hero-muted">
              This week
              <span className="block">
                {activeCount} study day{activeCount === 1 ? "" : "s"}
              </span>
            </p>
            <p className="font-mono text-[1.75rem] font-medium leading-none tracking-[-0.04em] tabular" aria-live="polite">
              {formatMinutes(total)}
            </p>
          </div>
        </div>
      </Card>

      <SectionLabel id="days-label">Study days</SectionLabel>
      <div role="group" aria-labelledby="days-label" className="stagger grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((d, i) => (
          <button
            key={d}
            type="button"
            aria-pressed={on[i]}
            onClick={() => toggle(i)}
            className={cn(
              "flex h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-[14px] border text-[13px] font-medium transition-colors duration-200",
              on[i] ? "border-transparent bg-primary text-primary-fg" : "border-border-strong bg-card text-muted hover:border-fg/40",
              d === today && "ring-4 ring-accent/30",
            )}
          >
            <span>{WEEKDAY_NAMES[d].short}</span>
            <span aria-hidden className={cn("font-mono text-xs tabular", on[i] && "opacity-70")}>
              {on[i] ? mins[i] : "rest"}
            </span>
            <span className="sr-only">
              {on[i] ? `, ${mins[i]} minutes` : ", rest day"}
              {d === today ? ", today" : ""}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-2.5 text-sm text-muted">Tap a day to switch it between study and rest; we fit your practice around it. Today is outlined.</p>

      <SectionLabel>Minutes per day</SectionLabel>
      {activeCount ? (
        <Card className="divide-y divide-border p-0 sm:p-0">
          {WEEKDAYS.map((d, i) =>
            on[i] ? (
              <div key={d} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <label htmlFor={`minutes-${d}`} className="text-[15px] font-medium">
                  {WEEKDAY_NAMES[d].long}
                </label>
                <Select id={`minutes-${d}`} value={mins[i]} onChange={(e) => setMinutes(i, Number(e.target.value))} className="h-10 w-[7.5rem] px-3">
                  {MINUTE_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m} min
                    </option>
                  ))}
                </Select>
              </div>
            ) : null,
          )}
        </Card>
      ) : (
        <Notice tone="warning">Pick at least one study day.</Notice>
      )}

      <SectionLabel>Reminder</SectionLabel>
      <Card>
        <label htmlFor="reminder-time" className="mb-2 block text-sm font-medium">
          Reminder time
        </label>
        <Input
          id="reminder-time"
          type="time"
          value={time}
          onChange={(e) => {
            setTime(e.target.value);
            setResult(null);
          }}
          className="max-w-[10rem] font-mono tabular"
        />
        <p className="mt-2.5 text-sm text-muted">
          If you have a streak going and haven&apos;t practiced yet, we&apos;ll nudge you between {formatReminderTime(`${hour}:00`)} and{" "}
          {formatReminderTime(`${hour}:59`)} your time{timeValid ? "" : " (no time picked, so 6 PM)"}. Never on rest days. Turn reminders off in Profile.
        </p>
      </Card>

      <div className="mt-6 space-y-3">
        {result ? <Notice tone={result.ok ? "success" : "error"}>{result.ok ? result.message : result.error}</Notice> : null}
        <Button variant="accent" size="lg" block disabled={pending || !activeCount} onClick={save}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Save plan
        </Button>
      </div>
    </div>
  );
}
