"use client";
import { useActionState, useState, useTransition } from "react";
import { useClientValue } from "@/lib/use-client-value";
import { Bell, Check, ChevronRight, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Notice, Select } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Toggle } from "@/components/ui/toggle";
import { Card, IconTile } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list";
import { cn } from "@/lib/cn";
import {
  inviteParent,
  removeParent,
  saveProfile,
  savePushSubscription,
  setAccent,
  setLeaderboardVisibility,
  setNotificationPref,
  setPrivacy,
  signOut,
} from "@/app/actions/profile";

export function ProfileForm({ initial }: { initial: { firstName: string; lastName: string; displayName: string; school: string; grade: number; dailyStudyMinutes: number } }) {
  const [state, action] = useActionState(saveProfile, undefined);
  return (
    <Card>
      <form action={action} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" name="firstName" defaultValue={initial.firstName} required maxLength={50} />
          </div>
          <div>
            <Label htmlFor="lastName">Last name</Label>
            <Input id="lastName" name="lastName" defaultValue={initial.lastName} required maxLength={50} />
          </div>
        </div>
        <div>
          <Label htmlFor="displayName">Display name</Label>
          <Input id="displayName" name="displayName" defaultValue={initial.displayName} maxLength={40} />
        </div>
        <div>
          <Label htmlFor="school">School</Label>
          <Input id="school" name="school" defaultValue={initial.school} maxLength={120} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="grade">Grade</Label>
            <Select id="grade" name="grade" defaultValue={initial.grade}>
              {[9, 10, 11, 12].map((g) => (
                <option key={g} value={g}>
                  Grade {g}
                </option>
              ))}
              <option value={8}>Grade 8 or below</option>
              <option value={13}>Graduated / other</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="dailyStudyMinutes">Daily study time</Label>
            <Select id="dailyStudyMinutes" name="dailyStudyMinutes" defaultValue={initial.dailyStudyMinutes}>
              {[10, 20, 30, 45, 60].map((m) => (
                <option key={m} value={m}>
                  About {m} minutes
                </option>
              ))}
            </Select>
          </div>
        </div>
        <FieldError>{state?.error}</FieldError>
        {state?.ok ? (
          <p role="status" className="flex items-center gap-2 text-sm font-medium text-success">
            <Check className="pop-in size-4" strokeWidth={3} aria-hidden /> Saved.
          </p>
        ) : null}
        <div className="pt-1">
          <SubmitButton block size="lg">
            Save changes
          </SubmitButton>
        </div>
      </form>
    </Card>
  );
}

export function AccentPicker({ current, level, accents }: { current: string; level: number; accents: { id: string; label: string; swatch: string; unlockLevel: number }[] }) {
  const [value, setValue] = useState(current);
  const [, start] = useTransition();
  const choose = (id: string) => {
    setValue(id);
    start(async () => {
      await setAccent(id);
      document.documentElement.dataset.accent = id;
    });
  };
  return (
    <div role="radiogroup" aria-label="App color" className="flex flex-wrap justify-between gap-x-2 gap-y-5 sm:justify-start sm:gap-x-8">
      {accents.map((a) => {
        const locked = level < a.unlockLevel;
        const selected = value === a.id;
        return (
          <label key={a.id} className={cn("group/swatch flex min-w-11 flex-col items-center text-center", locked ? "cursor-not-allowed" : "cursor-pointer")}>
            <input type="radio" name="accent" value={a.id} checked={selected} disabled={locked} onChange={() => choose(a.id)} className="peer sr-only" />
            <span
              aria-hidden
              style={{ background: a.swatch }}
              className={cn(
                "inline-flex size-11 items-center justify-center rounded-full text-accent-fg shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--fg)_14%,transparent)] transition-transform duration-200",
                "peer-checked:ring-2 peer-checked:ring-fg peer-checked:ring-offset-[3px] peer-checked:ring-offset-card",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-[6px] peer-focus-visible:outline-fg",
                locked ? "opacity-35" : "group-hover/swatch:scale-105",
              )}
            >
              {locked ? <Lock className="size-4" /> : selected ? <Check className="pop-in size-[18px]" strokeWidth={3} /> : null}
            </span>
            <span className={cn("mt-2.5 text-[11px] font-medium leading-tight", locked && "text-muted")}>{a.label}</span>
            {locked ? (
              <span className="mt-0.5 font-mono text-[11px] leading-tight text-muted tabular">
                <span className="sr-only">, locked until </span>
                Level {a.unlockLevel}
              </span>
            ) : null}
          </label>
        );
      })}
    </div>
  );
}

export function NotificationToggles({ prefs }: { prefs: Record<string, boolean> }) {
  const rows: [string, string, string?][] = [
    ["chapterAnnouncements", "Chapter announcements"],
    ["checkinOpen", "Check-in is open"],
    ["streakReminder", "Streak reminder", "Once a day, only if you haven't practiced yet."],
    ["competitionCountdown", "Competition countdown", "A week before and the day before."],
    ["weeklyRecapEmail", "Weekly recap email", "Sunday evening: your XP, questions and accuracy for the week."],
  ];
  return (
    <>
      {rows.map(([k, label, desc]) => (
        <Toggle key={k} label={label} description={desc} checked={prefs[k]} onChange={(v) => setNotificationPref(k, v)} />
      ))}
    </>
  );
}

function urlBase64ToUint8Array(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function PushCard({ vapidKey, configured }: { vapidKey: string; configured: boolean }) {
  type Status = "unknown" | "unsupported" | "granted" | "denied" | "default";
  const initial = useClientValue<Status>(() => (!("Notification" in window) || !("serviceWorker" in navigator) ? "unsupported" : (Notification.permission as Status)), "unknown");
  const [requested, setStatus] = useState<Status | null>(null);
  const status = requested ?? initial;
  const [busy, setBusy] = useState(false);
  const enable = async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setStatus(perm as Status);
      if (perm !== "granted" || !configured) return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await savePushSubscription(json);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="py-4">
      <div className="flex items-start gap-3.5">
        <IconTile inverse={status === "granted"}>
          <Bell />
        </IconTile>
        <div className="min-w-0 flex-1">
          <p className="font-medium tracking-[-0.01em]">Get notifications on this device</p>
          <p className="mt-0.5 text-sm text-muted">Announcements, check-in, streak and competition reminders. Pick which below.</p>
          {status === "unsupported" ? (
            <p className="mt-3 text-sm text-muted">This browser doesn&apos;t support notifications. On iPhone, add PrepX to your Home Screen first.</p>
          ) : status === "denied" ? (
            <p className="mt-3 text-sm text-muted">Notifications are blocked in your browser settings. You&apos;ll still see them in the app.</p>
          ) : status === "granted" ? (
            <p className="mt-3 text-sm font-medium">{configured ? "Notifications are on for this device." : "Allowed. Push delivery isn't configured on this server yet, so you'll see notifications in the app."}</p>
          ) : (
            <Button size="sm" className="mt-3" onClick={enable} disabled={busy}>
              <Bell className="size-4" aria-hidden /> Turn on notifications
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function FamilyCard({ link }: { link: { email: string; status: string } | null }) {
  const [state, action] = useActionState(inviteParent, undefined);
  const [pending, start] = useTransition();
  return (
    <Card>
      <div className="flex items-start gap-3.5">
        <IconTile>
          <Mail />
        </IconTile>
        <div className="min-w-0 flex-1">
          <p className="font-semibold tracking-[-0.01em]">Monthly email to a parent</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Once a month: days practiced, streak, test accuracy and judge scores. They confirm first, and you can remove it anytime. They never see your messages, AI conversations or
            written responses.
          </p>
        </div>
      </div>
      {link ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[16px] bg-subtle p-4">
          <span className="min-w-0 text-sm">
            <span className="block break-all font-medium">{link.email}</span>
            <span className="mt-0.5 flex items-center gap-1.5 text-muted">
              <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", link.status === "confirmed" ? "bg-success" : "bg-warning")} />
              {link.status === "confirmed" ? "Receiving monthly emails" : "Waiting for them to confirm"}
            </span>
          </span>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => start(() => removeParent())}>
            Remove
          </Button>
        </div>
      ) : (
        <form action={action} className="mt-5 space-y-3 border-t border-border pt-5">
          <Label htmlFor="parent-email">Parent or guardian email</Label>
          <Input id="parent-email" name="email" type="email" placeholder="parent@example.com" required />
          <FieldError>{state?.error}</FieldError>
          {state?.ok ? <Notice tone="success">{state.ok}</Notice> : null}
          <SubmitButton variant="outline" block>
            Send them an invite
          </SubmitButton>
        </form>
      )}
    </Card>
  );
}

export function PrivacyToggles(props: { hideName: boolean; share: boolean; leaderboard: string; alias: string; competitionEmails: boolean; productEmails: boolean; trophyUrl: string }) {
  const [lb, setLb] = useState(props.leaderboard);
  const [, start] = useTransition();
  return (
    <>
      <Toggle label="Hide my name on public trophy pages" description="Your trophy page shows badges only, with 'A PrepX competitor' instead of your name." checked={props.hideName} onChange={(v) => setPrivacy("hideNameOnTrophies", v)} />
      <div className="py-4">
        <label htmlFor="lb" className="font-medium tracking-[-0.01em]">
          Leaderboards
        </label>
        <p className="mt-0.5 text-sm text-muted">Global and organization leaderboards rank study activity, not ability. Off by default.</p>
        <Select id="lb" className="mt-3" value={lb} onChange={(e) => { const v = e.target.value; setLb(v); start(() => setLeaderboardVisibility(v)); }}>
          <option value="hidden">Don&apos;t include me</option>
          <option value="pseudonym">{props.alias ? `Include me with a nickname (${props.alias})` : "Include me with a nickname"}</option>
          <option value="name">Include me with my display name</option>
        </Select>
      </div>
      <Toggle
        label="Share study activity with my chapter's advisors"
        description="Off by default. When on, your chapter's advisors and board members see your weekly question count."
        checked={props.share}
        onChange={(v) => setPrivacy("shareActivityWithChapter", v)}
      />
      <Toggle label="Competition reminder emails" description="A week before and the day before your official dates." checked={props.competitionEmails} onChange={(v) => setNotificationPref("competitionReminderEmails", v)} />
      <Toggle label="Product update emails" description="Occasional news about new PrepX features." checked={props.productEmails} onChange={(v) => setNotificationPref("productUpdatesEmail", v)} />
      <ListRow href={props.trophyUrl} title="View my public trophy page" />
    </>
  );
}

export function SignOutRow({ icon }: { icon: React.ReactNode }) {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="group/row -mx-4 flex w-[calc(100%+2rem)] items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-subtle/60 sm:-mx-5 sm:w-[calc(100%+2.5rem)] sm:px-5"
      >
        <IconTile>{icon}</IconTile>
        <span className="min-w-0 flex-1 font-medium tracking-[-0.01em]">Sign out</span>
        <ChevronRight className="size-4 shrink-0 text-muted transition-transform duration-200 group-hover/row:translate-x-0.5 group-hover/row:text-fg" aria-hidden />
      </button>
    </form>
  );
}
