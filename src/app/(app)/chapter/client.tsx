"use client";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkInAction, leaveAction } from "@/app/actions/chapter";

export function CheckInButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div>
      <Button variant="accent" disabled={pending} onClick={() => start(async () => { const r = await checkInAction(id); setMsg(r?.error ?? r?.ok ?? null); })}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Check in
      </Button>
      {msg ? <p className="mt-2 text-sm" role="status">{msg}</p> : null}
    </div>
  );
}

export function LeaveButton({ chapterId, name }: { chapterId: string; name: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!confirm)
    return (
      <Button variant="ghost" size="sm" className="-ml-3.5 text-danger hover:bg-danger/10" onClick={() => setConfirm(true)}>
        Leave chapter
      </Button>
    );
  return (
    <div className="rounded-[24px] border border-danger/30 bg-card p-5 shadow-card sm:p-6">
      <p className="text-lg font-semibold tracking-[-0.02em]">Leave {name}?</p>
      <p className="mt-1 text-sm text-muted">Your chapter points stay with the chapter. You can rejoin later with a code.</p>
      {error ? <p role="alert" className="mt-2 text-sm text-danger">{error}</p> : null}
      <div className="mt-5 flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => setConfirm(false)}>
          Cancel
        </Button>
        <Button variant="danger" disabled={pending} onClick={() => start(async () => { const r = await leaveAction(chapterId); if (r?.error) setError(r.error); })}>
          Leave
        </Button>
      </div>
    </div>
  );
}
