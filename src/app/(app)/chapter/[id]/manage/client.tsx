"use client";
import { useActionState, useState, useTransition } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, HeroTexture } from "@/components/ui/card";
import { FieldError, Input, Label, Select, Textarea, Notice } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Chip } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { announceAction, closeCheckinAction, joinSettingsAction, openCheckinAction, removeAction, roleAction } from "@/app/actions/chapter";

export function CodePanel({ chapterId, code, expiresAt, enabled, canEdit }: { chapterId: string; code: string; expiresAt: string | null; enabled: boolean; canEdit: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const expired = expiresAt && new Date(expiresAt) < new Date();
  return (
    <Card tone="inverse" className="p-6 shadow-float sm:p-8">
      <HeroTexture />
      <div className="relative">
        <p className="eyebrow !text-hero-muted">Join code</p>
        <p data-testid="join-code" className={cn("mt-6 font-mono text-[3.25rem] font-medium leading-none tracking-[0.18em] tabular sm:text-[4.5rem]", (!enabled || expired) && "text-hero-muted line-through decoration-2")}>
          {code}
        </p>
        <p className="mt-5 max-w-md text-sm text-hero-muted">
          {!enabled ? "Joining is turned off." : expired ? "This code has expired." : expiresAt ? `Expires ${new Date(expiresAt).toLocaleDateString()}` : "Doesn't expire."} Members enter it at prep-x.app/join.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-hero-line pt-5">
          <Button size="sm" variant="accent" onClick={() => { void navigator.clipboard.writeText(code); setMsg("Copied"); }}>
            <Copy className="size-4" aria-hidden /> Copy
          </Button>
          {canEdit ? (
            <>
              <Button size="sm" variant="hero" disabled={pending} onClick={() => start(async () => setMsg((await joinSettingsAction(chapterId, { regenerate: true }))?.ok ?? null))}>
                <RefreshCw className="size-4" aria-hidden /> New code
              </Button>
              <label className="sr-only" htmlFor="expiry">
                Code expiry
              </label>
              <select
                id="expiry"
                className="h-9 rounded-[11px] bg-hero-fg px-3 text-sm font-medium text-hero transition-opacity hover:opacity-95"
                defaultValue=""
                onChange={(e) => start(async () => setMsg((await joinSettingsAction(chapterId, { expiresInDays: e.target.value ? Number(e.target.value) : null }))?.ok ?? null))}
              >
                <option value="">Expiry…</option>
                <option value="1">Expire in 1 day</option>
                <option value="7">Expire in 7 days</option>
                <option value="30">Expire in 30 days</option>
                <option value="0">Never expire</option>
              </select>
              <Button size="sm" variant="hero" disabled={pending} onClick={() => start(async () => setMsg((await joinSettingsAction(chapterId, { enabled: !enabled }))?.ok ?? null))}>
                {enabled ? "Turn off joining" : "Turn on joining"}
              </Button>
            </>
          ) : null}
        </div>
        {msg ? <p className="mt-3 text-sm text-hero-muted" role="status">{msg}</p> : null}
      </div>
    </Card>
  );
}

export function AnnounceForm({ chapterId }: { chapterId: string }) {
  const [state, action] = useActionState(announceAction, undefined);
  return (
    <Card>
      <form action={action} className="space-y-4">
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
    </Card>
  );
}

export function CheckinForm({ chapterId }: { chapterId: string }) {
  const [state, action] = useActionState(openCheckinAction, undefined);
  return (
    <Card>
      <form action={action} className="grid gap-4 sm:grid-cols-[1fr_auto_auto]">
        <input type="hidden" name="chapterId" value={chapterId} />
        <div>
          <Label htmlFor="ck-title">Meeting</Label>
          <Input id="ck-title" name="title" required maxLength={80} placeholder="General meeting" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:contents">
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
            <Input id="ck-pts" name="points" type="number" min={1} max={100} defaultValue={10} className="font-mono tabular sm:w-24" />
          </div>
        </div>
        <div className="sm:col-span-3">
          <FieldError>{state?.error}</FieldError>
          {state?.ok ? <Notice tone="success" className="mb-3">{state.ok}</Notice> : null}
          <SubmitButton>Open check-in</SubmitButton>
        </div>
      </form>
    </Card>
  );
}

export function CloseCheckin({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="outline" className="shrink-0" disabled={pending} onClick={() => start(() => closeCheckinAction(id))}>
      Close now
    </Button>
  );
}

type M = { userId: string; role: "member" | "officer" | "advisor"; name: string; points: number | null; questionsThisWeek: number | null };

export function MemberRow({ chapterId, member, isSelf, canChangeRole, canRemove }: { chapterId: string; member: M; isSelf: boolean; canChangeRole: boolean; canRemove: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <li className="py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium tracking-[-0.01em] [overflow-wrap:anywhere]">
            {member.name}
            {isSelf ? " (you)" : ""}
          </p>
          <p className="mt-0.5 text-sm text-muted">{member.questionsThisWeek !== null ? `${member.questionsThisWeek} questions this week` : "Activity private"}</p>
        </div>
        {member.points !== null ? (
          <p className="shrink-0 text-right">
            <span className="font-mono text-lg font-medium tracking-[-0.03em] tabular">{member.points}</span> <span className="text-xs text-muted">pts</span>
          </p>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canChangeRole ? (
          <>
            <label className="sr-only" htmlFor={`role-${member.userId}`}>
              Role for {member.name}
            </label>
            <Select
              id={`role-${member.userId}`}
              value={member.role}
              disabled={pending}
              onChange={(e) => start(async () => { const r = await roleAction(chapterId, member.userId, e.target.value as M["role"]); setMsg(r?.error ?? r?.ok ?? null); })}
              className="h-9 w-auto rounded-[11px] px-3 text-sm"
            >
              <option value="member">Member</option>
              <option value="officer">Board member</option>
              <option value="advisor">Advisor</option>
            </Select>
          </>
        ) : (
          <Chip>{member.role === "officer" ? "Board member" : member.role === "advisor" ? "Advisor" : "Member"}</Chip>
        )}
        {canRemove ? (
          <Button size="sm" variant="ghost" className="text-danger hover:bg-danger/10" disabled={pending} onClick={() => start(async () => { const r = await removeAction(chapterId, member.userId); setMsg(r?.error ?? r?.ok ?? null); })}>
            Remove
          </Button>
        ) : null}
        {msg ? <span className="text-sm text-muted" role="status">{msg}</span> : null}
      </div>
    </li>
  );
}
