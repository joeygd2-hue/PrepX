"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowUp, Loader2, Sparkles, X } from "lucide-react";
import { Markdown } from "@/components/ui/markdown";
import { cn } from "@/lib/cn";
import { askAi } from "@/app/actions/ask";

type Turn = { role: "user" | "assistant"; content: string };
type Mode = "explain" | "define" | "example" | "simpler";
const QUICK: { mode: Mode; label: string; prompt: string }[] = [
  { mode: "explain", label: "Explain", prompt: "Explain this" },
  { mode: "define", label: "Define", prompt: "Define this" },
  { mode: "example", label: "Example", prompt: "Give an example" },
  { mode: "simpler", label: "Simpler", prompt: "Explain it more simply" },
];
const MIN = 2;
const MAX = 1200;
/** Opens the panel from anywhere (e.g. an "Ask AI" button): `window.dispatchEvent(new Event(ASK_EVENT))`. */
export const ASK_EVENT = "prepx:ask";

function selectionInfo() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const text = sel.toString().replace(/\s+/g, " ").trim();
  if (text.length < MIN || text.length > MAX) return null;
  const range = sel.getRangeAt(0);
  const node = range.commonAncestorContainer;
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  if (!el) return null;
  // Not in form fields, not where it's switched off (timed exams), and only inside the page content.
  if (el.closest("input, textarea, select, [contenteditable='true'], [data-ask-ai='off'], [data-ask-ai-panel]")) return null;
  if (!el.closest("main")) return null;
  const block = el.closest("[data-ask-context], li, p, section, article, blockquote") ?? el;
  const context = (block.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 1500);
  const rect = range.getBoundingClientRect();
  if (!rect.width && !rect.height) return null;
  return { text, context, rect };
}

/**
 * Highlight-to-explain helper. Select text in the study area and an "Ask AI" pill appears;
 * the panel explains, defines or gives examples, and takes typed follow-up questions.
 */
export function AskAi() {
  const [pill, setPill] = useState<{ text: string; context: string; top: number; left: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState<{ text: string; context: string } | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [modeOfFirst, setModeOfFirst] = useState<Mode | "question">("explain");
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [mock, setMock] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  const refreshPill = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const info = selectionInfo();
      if (!info) {
        setPill(null);
        return;
      }
      const touch = window.matchMedia("(pointer: coarse)").matches;
      // On touch screens the system's copy menu sits above the selection, so go below it.
      const top = touch ? info.rect.bottom + 12 : info.rect.top - 48;
      const left = Math.min(Math.max(info.rect.left + info.rect.width / 2, 72), window.innerWidth - 72);
      setPill({ text: info.text, context: info.context, top: Math.max(8, Math.min(top, window.innerHeight - 56)), left });
    }, 160);
  }, []);

  useEffect(() => {
    const hide = () => setPill(null);
    const onOpen = () => {
      opener.current = document.activeElement as HTMLElement | null;
      setSubject(null);
      setTurns([]);
      setError(null);
      setModeOfFirst("question");
      setOpen(true);
    };
    document.addEventListener("selectionchange", refreshPill);
    window.addEventListener("scroll", hide, { passive: true });
    window.addEventListener("resize", hide);
    window.addEventListener(ASK_EVENT, onOpen);
    return () => {
      document.removeEventListener("selectionchange", refreshPill);
      window.removeEventListener("scroll", hide);
      window.removeEventListener("resize", hide);
      window.removeEventListener(ASK_EVENT, onOpen);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [refreshPill]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [turns, pending]);

  const close = useCallback(() => {
    setOpen(false);
    opener.current?.focus?.();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const send = (mode: Mode | "question", label: string, question: string | null, base: Turn[], about: { text: string; context: string } | null) => {
    setError(null);
    const shown: Turn[] = [...base, { role: "user", content: label }];
    setTurns(shown);
    start(async () => {
      const res = await askAi({
        selection: about?.text ?? "",
        context: about?.context ?? "",
        mode: base.length ? "question" : mode,
        question: base.length ? label : question,
        // Only the first turn uses a quick-action mode; follow-ups are sent as plain questions with the history.
        history: base,
      });
      if (res.ok) {
        setTurns([...shown, { role: "assistant", content: res.answer }]);
        setRemaining(res.remaining);
        setMock(res.mock);
      } else {
        setTurns(base);
        setError(res.error);
      }
    });
  };

  const openFor = (p: { text: string; context: string }) => {
    opener.current = document.activeElement as HTMLElement | null;
    const words = p.text.split(" ").length;
    const first: Mode = words <= 4 ? "define" : "explain";
    const q = QUICK.find((x) => x.mode === first)!;
    setSubject(p);
    setPill(null);
    setOpen(true);
    setModeOfFirst(first);
    window.getSelection()?.removeAllRanges();
    send(first, q.prompt, null, [], p);
  };

  const quick = (q: (typeof QUICK)[number]) => {
    if (pending) return;
    if (!turns.length) {
      setModeOfFirst(q.mode);
      send(q.mode, q.prompt, null, [], subject);
    } else send("question", q.prompt, null, turns, subject);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = draft.trim();
    if (!q || pending) return;
    setDraft("");
    if (!turns.length) {
      setModeOfFirst("question");
      send("question", q, q, [], subject);
    } else send("question", q, q, turns, subject);
  };

  return (
    <>
      {pill && !open ? (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => openFor(pill)}
          className="pop-in fixed z-50 inline-flex h-10 -translate-x-1/2 items-center gap-1.5 rounded-full bg-hero px-4 text-sm font-medium text-hero-fg shadow-float transition-transform hover:scale-[1.03]"
          style={{ top: pill.top, left: pill.left }}
        >
          <Sparkles className="size-4 text-accent" aria-hidden /> Ask AI
          <span className="sr-only"> about the selected text</span>
        </button>
      ) : null}

      {open ? (
        <>
          <button type="button" aria-label="Close Ask AI" tabIndex={-1} onClick={close} className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[1px] sm:hidden" />
          <section
            role="dialog"
            aria-label="Ask AI"
            data-ask-ai-panel
            className="pop-in fixed inset-x-3 bottom-3 z-50 flex max-h-[75dvh] flex-col overflow-hidden rounded-[24px] border border-border bg-card shadow-float sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-4 sm:max-h-none sm:w-[400px]"
          >
            <header className="flex items-center gap-2.5 border-b border-border px-4 py-3">
              <span aria-hidden className="inline-flex size-8 items-center justify-center rounded-full bg-accent text-accent-fg">
                <Sparkles className="size-4" />
              </span>
              <h2 className="flex-1 font-semibold tracking-[-0.01em]">Ask AI</h2>
              {remaining !== null ? <span className="font-mono text-[11px] text-muted tabular">{remaining} left today</span> : null}
              <button type="button" onClick={close} aria-label="Close" className="-mr-1 rounded-full p-1.5 text-muted transition-colors hover:bg-subtle hover:text-fg">
                <X className="size-[18px]" aria-hidden />
              </button>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
              {subject ? (
                <blockquote className="border-l-2 border-accent pl-3 text-sm leading-relaxed text-muted [overflow-wrap:anywhere]">
                  <span className="line-clamp-4">{subject.text}</span>
                </blockquote>
              ) : (
                <p className="text-sm text-muted">Ask anything about your event: a term, a concept, a strategy. Tip: highlight text on any study page to ask about it.</p>
              )}
              {subject ? (
                <div className="flex flex-wrap gap-2">
                  {QUICK.map((q) => (
                    <button
                      key={q.mode}
                      type="button"
                      disabled={pending}
                      onClick={() => quick(q)}
                      className={cn(
                        "h-8 rounded-full border px-3 text-[13px] font-medium transition-colors disabled:opacity-50",
                        turns.length === 0 && modeOfFirst === q.mode ? "border-transparent bg-primary text-primary-fg" : "border-border-strong hover:bg-subtle",
                      )}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              ) : null}
              {turns.map((t, i) =>
                t.role === "user" ? (
                  <p key={i} className="ml-auto w-fit max-w-[85%] rounded-[16px] rounded-br-[6px] bg-primary px-3.5 py-2 text-sm text-primary-fg [overflow-wrap:anywhere]">
                    {t.content}
                  </p>
                ) : (
                  <div key={i} className="text-[15px] [overflow-wrap:anywhere]">
                    <Markdown source={t.content} />
                  </div>
                ),
              )}
              {pending ? (
                <div className="space-y-2" role="status" aria-label="Thinking">
                  <div className="skeleton h-3 w-11/12 rounded-full" />
                  <div className="skeleton h-3 w-9/12 rounded-full" />
                  <div className="skeleton h-3 w-10/12 rounded-full" />
                </div>
              ) : null}
              {error ? (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              ) : null}
              {mock ? <p className="text-xs text-muted">Development mode: answers come from a test provider, not a real AI.</p> : null}
              <div ref={end} />
            </div>

            <form onSubmit={submit} className="flex items-end gap-2 border-t border-border p-3">
              <label htmlFor="ask-ai-input" className="sr-only">
                Ask a question
              </label>
              <textarea
                id="ask-ai-input"
                ref={input}
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) submit(e);
                }}
                maxLength={1000}
                autoFocus
                placeholder={subject ? "Ask a follow-up…" : "Ask a question…"}
                className="max-h-32 min-h-11 flex-1 resize-none rounded-[14px] border border-border-strong bg-card px-3.5 py-2.5 text-[15px] placeholder:text-muted/80 focus:border-fg focus:outline-none focus:ring-4 focus:ring-accent/35"
              />
              <button
                type="submit"
                disabled={pending || !draft.trim()}
                aria-label="Send"
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-primary text-primary-fg transition-opacity disabled:opacity-40"
              >
                {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ArrowUp className="size-4" aria-hidden />}
              </button>
            </form>
            <p className="px-4 pb-3 text-[11px] text-muted">AI explanations can be wrong. Check facts against your lessons and official guidelines.</p>
          </section>
        </>
      ) : null}
    </>
  );
}

/** Button that opens the Ask AI panel with an empty question box. */
export function AskAiButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(ASK_EVENT))}
      className={cn(
        "inline-flex h-10 items-center gap-1.5 rounded-full border border-border-strong bg-card px-3.5 text-sm font-medium shadow-card transition-colors hover:bg-subtle",
        className,
      )}
    >
      <Sparkles className="size-4" aria-hidden /> Ask AI
    </button>
  );
}
