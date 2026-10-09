"use client";
import { useActionState, useState, useTransition } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select, Textarea, Notice } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Chip } from "@/components/ui/badge";
import { announceAction, closeCheckinAction, joinSettingsAction, openCheckinAction, removeAction, roleAction } from "@/app/actions/chapter";

export function CodePanel({ chapterId, code, expiresAt, enabled, canEdit }: { chapterId: string; code: string; expiresAt: string | null; enabled: boolean; canEdit: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const expired = expiresAt && new Date(expiresAt) < new Date();
  return (
    <section className="rounded-3xl bg-fg p-6 text-bg">
      <p className="eyebrow !text-bg/70">Join code</p>
      <p className="mt-2 text-5xl font-semibold tracking-[0.3em] tabular">{code}</p>
      <p className="mt-2 text-sm opacity-80">
        {!enabled ? "Joining is turned off." : expired ? "This code has expired." : expiresAt ? `Expires ${new Date(expiresAt).toLocaleDateString()}` : "Doesn't expire."} Members enter it at prepx.app/join.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="subtle" className="bg-bg text-fg" onClick={() => { void navigator.clipboard.writeText(code); setMsg("Copied"); }}>
          <Copy className="size-4" aria-hidden /> Copy
        </Button>
        {canEdit ? (
          <>
            <Button size="sm" variant="subtle" className="bg-bg text-fg" disabled={pending} onClick={() => start(async () => setMsg((await joinSettingsAction(chapterId, { regenerate: true }))?.ok ?? null))}>
              <RefreshCw className="size-4" aria-hidden /> New code
            </Button>
            <label className="sr-only" htmlFor="expiry">
              Code expiry
            </label>
            <select
              id="expiry"
              className="h-9 rounded-full bg-bg px-3 text-sm text-fg"
              defaultValue=""
              onChange={(e) => start(async () => setMsg((await joinSettingsAction(chapterId, { expiresInDays: e.target.value ? Number(e.target.value) : null }))?.ok ?? null))}
            >
              <option value="">Expiry…</option>
              <option value="1">Expire in 1 day</option>
              <option value="7">Expire in 7 days</option>
              <option value="30">Expire in 30 days</option>
              <option value="0">Never expire</option>
            </select>
            <Button size="sm" variant="subtle" className="bg-bg text-fg" disabled={pending} onClick={() => start(async () => setMsg((await joinSettingsAction(chapterId, { enabled: !enabled }))?.ok ?? null))}>
              {enabled ? "Turn off joining" : "Turn on joining"}
            </Button>
          </>
        ) : null}
      </div>
      {msg ? <p className="mt-2 text-sm" role="status">{msg}</p> : null}
    </section>
  );
}

export function AnnounceForm({ chapterId }: { chapterId: string }) {
  const [state, action] = useActionState(announceAction, undefined);
  return (
    <form action={action} className="space-y-3 rounded-3xl border border-border p-5">
      <input type="hidden" name="chapterId" value={chapterId} />
      <div>
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required maxLength={100} />
      </div>
      <div>
        <Label htmlFor="body">Message</Label>
        <Textarea id="body" name="body" rows={4} required maxLength={2000} />
      </div>
      <FieldError>{state?.error}</FieldError>
      {state?.ok ? <Notice tone="success">{state.ok}</Notice> : null}
      <SubmitButton>Post to members</SubmitButton>
    </form>
  );
}

export function CheckinForm({ chapterId }: { chapterId: string }) {
  const [state, action] = useActionState(openCheckinAction, undefined);
  return (
    <form action={action} className="grid gap-3 rounded-3xl border border-border p-5 sm:grid-cols-[1fr_auto_auto]">
      <input type="hidden" name="chapterId" value={chapterId} />
      <div>
        <Label htmlFor="ck-title">Meeting</Label>
        <Input id="ck-title" name="title" required maxLength={80} placeholder="General meeting" />
      </div>
      <div>
        <Label htmlFor="ck-min">Open for</Label>
        <Select id="ck-min" name="minutes" defaultValue="30">
          {[15, 30, 60, 120].map((m) => (
            <option key={m} value={m}>
              {m} min
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="ck-pts">Points</Label>
        <Input id="ck-pts" name="points" type="number" min={1} max={100} defaultValue={10} className="w-24" />
      </div>
      <div className="sm:col-span-3">
        <FieldError>{state?.error}</FieldError>
        {state?.ok ? <Notice tone="success" className="mb-3">{state.ok}</Notice> : null}
        <SubmitButton>Open check-in</SubmitButton>
      </div>
    </form>
  );
}

export function CloseCheckin({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={() => start(() => closeCheckinAction(id))}>
      Close now
    </Button>
  );
}

type M = { userId: string; role: "member" | "officer" | "advisor"; name: string; points: number; questionsThisWeek: number | null; sharesActivity: boolean };

export function MemberRow({ chapterId, member, isSelf, canChangeRole, canRemove }: { chapterId: string; member: M; isSelf: boolean; canChangeRole: boolean; canRemove: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex-1 font-medium">
          {member.name}
          {isSelf ? " (you)" : ""}
        </span>
        <Chip>{member.points} pts</Chip>
        <span className="text-sm text-muted">{member.questionsThisWeek !== null ? `${member.questionsThisWeek} questions this week` : "Activity private"}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {canChangeRole ? (
          <>
            <label className="sr-only" htmlFor={`role-${member.userId}`}>
              Role for {member.name}
            </label>
            <select
              id={`role-${member.userId}`}
              value={member.role}
              disabled={pending}
              onChange={(e) => start(async () => { const r = await roleAction(chapterId, member.userId, e.target.value as M["role"]); setMsg(r?.error ?? r?.ok ?? null); })}
              className="h-9 rounded-full border border-border bg-card px-3 text-sm"
            >
              <option value="member">Member</option>
              <option value="officer">Board member</option>
              <option value="advisor">Advisor</option>
            </select>
          </>
        ) : (
          <Chip>{member.role === "officer" ? "Board member" : member.role === "advisor" ? "Advisor" : "Member"}</Chip>
        )}
        {canRemove ? (
          <Button size="sm" variant="ghost" className="text-danger" disabled={pending} onClick={() => start(async () => { const r = await removeAction(chapterId, member.userId); setMsg(r?.error ?? r?.ok ?? null); })}>
            Remove
          </Button>
        ) : null}
        {msg ? <span className="text-sm" role="status">{msg}</span> : null}
      </div>
    </li>
  );
}
