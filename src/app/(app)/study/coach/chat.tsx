"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowUp, Loader2, MessageCircle, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, HeroTexture } from "@/components/ui/card";
import { Textarea } from "@/components/ui/form";
import { Chip } from "@/components/ui/badge";
import { deleteAiSession, sendCoachMessage } from "@/app/actions/ai";

type Msg = { role: "user" | "assistant"; content: string };

/** Small ink avatar that marks the coach's side of the conversation. */
function CoachMark() {
  return (
    <span aria-hidden className="mb-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-primary text-primary-fg [&>svg]:size-4">
      <Sparkles />
    </span>
  );
}

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
      <div className="mb-5 flex min-h-9 items-center justify-between gap-3">
        <Chip className="font-mono tabular">{remaining === null ? "Unlimited messages" : `${remaining} message${remaining === 1 ? "" : "s"} left today`}</Chip>
        {sessionId ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted hover:text-fg"
            onClick={() => start(async () => { await deleteAiSession(sessionId); router.replace("/study/coach"); setMessages([]); setSessionId(null); })}
          >
            <Trash2 className="size-4" aria-hidden /> Delete chat
          </Button>
        ) : null}
      </div>
      <div className="space-y-4" aria-live="polite">
        {messages.length === 0 ? (
          <Card tone="inverse" className="p-6 shadow-float sm:p-8">
            <HeroTexture />
            <div className="relative">
              <span aria-hidden className="inline-flex size-11 items-center justify-center rounded-[14px] bg-hero-fg text-hero [&>svg]:size-5">
                <MessageCircle />
              </span>
              <p className="mt-6 text-[1.6rem] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[1.85rem]">Ask me anything about your event.</p>
              <p className="mt-3 max-w-md leading-relaxed text-hero-muted">I&apos;ll explain concepts, check your answers and help you practice. I won&apos;t do your entry for you, but I&apos;ll help you make it great.</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {props.suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="min-h-10 rounded-full border border-hero-line px-4 py-2 text-left text-sm text-hero-fg transition-colors hover:border-hero-muted hover:bg-hero-line"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        ) : null}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap break-words rounded-[20px] rounded-br-[6px] bg-primary px-4 py-3 text-[15px] leading-relaxed text-primary-fg">
              <span className="sr-only">You:</span>
              {m.content}
            </div>
          ) : (
            <div key={i} className="flex items-end gap-2.5">
              <CoachMark />
              <div className="min-w-0 max-w-[85%] whitespace-pre-wrap break-words rounded-[20px] rounded-bl-[6px] border border-border bg-card px-4 py-3 text-[15px] leading-relaxed shadow-card">
                <span className="sr-only">Coach:</span>
                {m.content}
              </div>
            </div>
          ),
        )}
        {pending ? (
          <div className="flex items-end gap-2.5">
            <CoachMark />
            <div className="inline-flex items-center gap-2 rounded-[20px] rounded-bl-[6px] border border-border bg-card px-4 py-3 text-sm text-muted shadow-card" role="status">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Coach is thinking…
            </div>
          </div>
        ) : null}
        {/* Scroll margin keeps the newest message clear of the floating composer and the dock. */}
        <div ref={end} className="scroll-mb-52" />
      </div>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error.text}{" "}
          {error.limit ? (
            <Link href="/profile/plan" className="font-semibold underline underline-offset-4">
              See plans
            </Link>
          ) : null}
        </p>
      ) : null}
      <form
        className="sticky bottom-[calc(max(env(safe-area-inset-bottom),14px)+4.75rem)] z-30 mt-6 flex items-end gap-2 rounded-[22px] border border-border-strong bg-card p-2 shadow-float transition-[border-color,box-shadow] duration-150 focus-within:border-fg focus-within:ring-4 focus-within:ring-accent/35"
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
          className="min-h-11 resize-none border-0 bg-transparent px-3 py-2.5 focus:ring-0 focus-visible:!outline-none"
        />
        <Button type="submit" variant="accent" aria-label="Send" disabled={pending || !draft.trim() || remaining === 0} className="size-11 shrink-0 rounded-[14px] p-0">
          <ArrowUp className="size-5" aria-hidden />
        </Button>
      </form>
    </div>
  );
}
