"use client";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { useClientValue } from "@/lib/use-client-value";
import { Bell, ChevronRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Notice, Select } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Toggle } from "@/components/ui/toggle";
import { IconTile } from "@/components/ui/card";
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
    <form action={action} className="space-y-4 rounded-3xl bg-subtle p-5">
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
      {state?.ok ? <p role="status" className="text-sm text-success">Saved.</p> : null}
      <SubmitButton block size="lg">
        Save changes
      </SubmitButton>
    </form>
  );
}

export function AccentPicker({ current, level, accents }: { current: string; level: number; accents: { id: string; label: string; swatch: string; unlockLevel: number }[] }) {
  const [value, setValue] = useState(current);
  const [, start] = useTransition();
  return (
    <div role="radiogroup" aria-label="App color" className="flex flex-wrap gap-5">
      {accents.map((a) => {
        const locked = level < a.unlockLevel;
        return (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={value === a.id}
            aria-disabled={locked}
            disabled={locked}
            onClick={() => start(async () => { setValue(a.id); await setAccent(a.id); document.documentElement.dataset.accent = a.id; })}
            className="flex w-16 flex-col items-center gap-1.5 text-xs disabled:cursor-not-allowed"
          >
            <span className={cn("inline-flex size-11 items-center justify-center rounded-full", value === a.id && "ring-2 ring-fg ring-offset-2 ring-offset-bg", locked && "opacity-60")} style={{ background: a.swatch }} />
            <span className="inline-flex items-center gap-0.5 text-center">
              {locked ? <Lock className="size-3 text-warning" aria-label="Locked" /> : null}
              {a.label}
            </span>
          </button>
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
    <div className="divide-y divide-border">
      {rows.map(([k, label, desc]) => (
        <Toggle key={k} label={label} description={desc} checked={prefs[k]} onChange={(v) => setNotificationPref(k, v)} />
      ))}
    </div>
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
    <div className="border-b border-border py-5">
      <p className="font-semibold">Get notifications on this device</p>
      <p className="mt-1 text-sm text-muted">Announcements, check-in, streak and competition reminders. Pick which below.</p>
      {status === "unsupported" ? (
        <p className="mt-3 text-sm text-muted">This browser doesn&apos;t support notifications. On iPhone, add PrepX to your Home Screen first.</p>
      ) : status === "denied" ? (
        <p className="mt-3 text-sm text-muted">Notifications are blocked in your browser settings. You&apos;ll still see them in the app.</p>
      ) : status === "granted" ? (
        <p className="mt-3 text-sm font-medium">{configured ? "Notifications are on for this device." : "Allowed. Push delivery isn't configured on this server yet, so you'll see notifications in the app."}</p>
      ) : (
        <Button block className="mt-4" onClick={enable} disabled={busy}>
          <Bell className="size-4" aria-hidden /> Turn on notifications
        </Button>
      )}
    </div>
  );
}

export function FamilyCard({ link }: { link: { email: string; status: string } | null }) {
  const [state, action] = useActionState(inviteParent, undefined);
  const [pending, start] = useTransition();
  return (
    <div className="rounded-3xl border border-border p-5">
      <p className="font-semibold">Monthly email to a parent</p>
      <p className="mt-1 text-sm text-muted">
        Once a month: days practiced, streak, test accuracy and judge scores. They confirm first, and you can remove it anytime. They never see your messages, AI conversations or written
        responses.
      </p>
      {link ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-subtle p-4">
          <span className="text-sm">
            {link.email} · {link.status === "confirmed" ? "Receiving monthly emails" : "Waiting for them to confirm"}
          </span>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => start(() => removeParent())}>
            Remove
          </Button>
        </div>
      ) : (
        <form action={action} className="mt-4 space-y-3">
          <Label htmlFor="parent-email">Parent or guardian email</Label>
          <Input id="parent-email" name="email" type="email" placeholder="parent@example.com" required />
          <FieldError>{state?.error}</FieldError>
          {state?.ok ? <Notice tone="success">{state.ok}</Notice> : null}
          <SubmitButton variant="outline" block>
            Send them an invite
          </SubmitButton>
        </form>
      )}
    </div>
  );
}

export function PrivacyToggles(props: { hideName: boolean; share: boolean; leaderboard: string; competitionEmails: boolean; productEmails: boolean; trophyUrl: string }) {
  const [lb, setLb] = useState(props.leaderboard);
  const [, start] = useTransition();
  return (
    <div className="divide-y divide-border">
      <Toggle label="Hide my name on public trophy pages" description="Your trophy page shows badges only, with 'A PrepX competitor' instead of your name." checked={props.hideName} onChange={(v) => setPrivacy("hideNameOnTrophies", v)} />
      <div className="py-4">
        <label htmlFor="lb" className="font-medium">
          Leaderboards
        </label>
        <p className="mt-0.5 text-sm text-muted">Global and organization leaderboards rank study activity, not ability. Off by default.</p>
        <Select id="lb" className="mt-3" value={lb} onChange={(e) => { const v = e.target.value; setLb(v); start(() => setLeaderboardVisibility(v)); }}>
          <option value="hidden">Don&apos;t include me</option>
          <option value="pseudonym">Include me with a nickname (initials)</option>
          <option value="name">Include me with my display name</option>
        </Select>
      </div>
      <Toggle label="Share study activity with my chapter's advisors" description="Advisors and board members see your weekly question count. Turn off to keep it private." checked={props.share} onChange={(v) => setPrivacy("shareActivityWithChapter", v)} />
      <Toggle label="Competition reminder emails" description="A week before and the day before your official dates." checked={props.competitionEmails} onChange={(v) => setNotificationPref("competitionReminderEmails", v)} />
      <Toggle label="Product update emails" description="Occasional news about new PrepX features." checked={props.productEmails} onChange={(v) => setNotificationPref("productUpdatesEmail", v)} />
      <Link href={props.trophyUrl} className="flex items-center justify-between py-4 font-medium">
        View my public trophy page <ChevronRight className="size-5 text-muted" aria-hidden />
      </Link>
    </div>
  );
}

export function SignOutRow({ icon }: { icon: React.ReactNode }) {
  return (
    <form action={signOut}>
      <button type="submit" className="-mx-5 flex w-[calc(100%+2.5rem)] items-center gap-4 px-5 py-4 text-left hover:bg-subtle/60">
        <IconTile>{icon}</IconTile>
        <span className="flex-1 font-medium">Sign out</span>
        <ChevronRight className="size-5 text-muted" aria-hidden />
      </button>
    </form>
  );
}
