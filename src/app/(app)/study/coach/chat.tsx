"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowUp, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { Chip } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { deleteAiSession, sendCoachMessage } from "@/app/actions/ai";

type Msg = { role: "user" | "assistant"; content: string };

export function CoachChat(props: { sessionId: string | null; initialMessages: Msg[]; remaining: number | null; resets: string; initialDraft: string; suggestions: string[] }) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState(props.sessionId);
  const [messages, setMessages] = useState<Msg[]>(props.initialMessages);
  const [draft, setDraft] = useState(props.initialDraft);
  const [remaining, setRemaining] = useState(props.remaining);
  const [error, setError] = useState<{ text: string; limit?: boolean } | null>(null);
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Block body: scrollIntoView() returns a Promise in newer browsers, and effects may only return a cleanup function.
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || pending) return;
    setError(null);
    setMessages((m) => [...m, { role: "user", content: t }]);
    setDraft("");
    start(async () => {
      const r = await sendCoachMessage(sessionId, t);
      if (!r.ok) {
        setMessages((m) => m.slice(0, -1));
        setDraft(t);
        setError({ text: r.error, limit: r.limit });
        return;
      }
      setMessages((m) => [...m, { role: "assistant", content: r.data!.reply }]);
      if (!sessionId) {
        setSessionId(r.data!.sessionId);
        router.replace(`/study/coach?s=${r.data!.sessionId}`, { scroll: false });
      }
      setRemaining((x) => (x === null ? x : Math.max(0, x - 1)));
    });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Chip>{remaining === null ? "Unlimited messages" : `${remaining} message${remaining === 1 ? "" : "s"} left today`}</Chip>
        {sessionId ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"
            onClick={() => start(async () => { await deleteAiSession(sessionId); router.replace("/study/coach"); setMessages([]); setSessionId(null); })}
          >
            <Trash2 className="size-4" aria-hidden /> Delete chat
          </button>
        ) : null}
      </div>
      <div className="space-y-3" aria-live="polite">
        {messages.length === 0 ? (
          <div className="rounded-3xl bg-subtle p-5">
            <p className="font-semibold">Ask me anything about your event.</p>
            <p className="mt-1 text-sm text-muted">I&apos;ll explain concepts, check your answers and help you practice. I won&apos;t do your entry for you, but I&apos;ll help you make it great.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {props.suggestions.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-border bg-bg px-3 py-1.5 text-sm hover:border-fg">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {messages.map((m, i) => (
          <div key={i} className={cn("max-w-[88%] whitespace-pre-wrap rounded-3xl px-4 py-3", m.role === "user" ? "ml-auto bg-fg text-bg" : "bg-subtle")}>
            <span className="sr-only">{m.role === "user" ? "You:" : "Coach:"}</span>
            {m.content}
          </div>
        ))}
        {pending ? (
          <div className="inline-flex items-center gap-2 rounded-3xl bg-subtle px-4 py-3 text-muted" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Coach is thinking…
          </div>
        ) : null}
        <div ref={end} />
      </div>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error.text}{" "}
          {error.limit ? (
            <Link href="/profile/plan" className="font-semibold underline">
              See plans
            </Link>
          ) : null}
        </p>
      ) : null}
      <form
        className="sticky bottom-20 mt-5 flex items-end gap-2 rounded-3xl border border-border bg-bg p-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <label htmlFor="coach-input" className="sr-only">
          Message the coach
        </label>
        <Textarea
          id="coach-input"
          rows={2}
          value={draft}
          maxLength={4000}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(draft);
            }
          }}
          placeholder="Ask about a concept, indicator or strategy…"
          className="resize-none border-0 focus:border-0"
        />
        <Button type="submit" aria-label="Send" disabled={pending || !draft.trim() || remaining === 0} className="size-11 shrink-0 p-0">
          <ArrowUp className="size-5" aria-hidden />
        </Button>
      </form>
    </div>
  );
}
