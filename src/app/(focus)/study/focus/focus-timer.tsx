"use client";
import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ArrowLeft, ArrowRight, Check, Coffee, Pause, Play } from "lucide-react";
import { completeFocusSession } from "@/app/actions/planner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

const LENGTHS = [15, 25, 45] as const;
type Length = (typeof LENGTHS)[number];
const BREAK_MINUTES = 5;
const STORAGE_KEY = "prepx:focus";
/** A session that ended longer ago than this (the tab was closed) is shown as done but not logged. */
const LOG_GRACE_MS = 4 * 3600_000;
/** A finished session or break older than this is old news: the screen goes back to a fresh start. */
const STALE_MS = 12 * 3600_000;
/** Only chime for a countdown that just ended, not one found finished long after. */
const CHIME_WINDOW_MS = 2 * 60_000;

type FocusState =
  | { phase: "idle"; minutes: Length; afterBreak?: number }
  | { phase: "running"; minutes: Length; endAt: number }
  | { phase: "paused"; minutes: Length; remainingMs: number }
  | { phase: "done"; minutes: Length; endedAt: number; late?: boolean }
  | { phase: "break"; minutes: Length; endAt: number };

// ---- Timer state lives in localStorage (survives refresh, syncs across tabs); memory is the fallback.
const IDLE: FocusState = { phase: "idle", minutes: 25 };
const stateListeners = new Set<() => void>();
let rawState: string | null | undefined;
/** False once storage throws: from then on the in-memory copy is the only source. */
let storageOk = true;

function readRaw(): string | null {
  if (rawState === undefined) {
    try {
      rawState = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      storageOk = false;
      rawState = null;
    }
  }
  return rawState;
}

function subscribeState(listener: () => void) {
  stateListeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    rawState = e.newValue;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    stateListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
    // Nobody is listening for other tabs' changes now, so re-read storage on the next visit.
    if (!stateListeners.size && storageOk) rawState = undefined;
  };
}

function writeState(next: FocusState) {
  rawState = JSON.stringify(next);
  try {
    window.localStorage.setItem(STORAGE_KEY, rawState);
  } catch {
    // Private mode or storage full: the timer still works for this visit.
    storageOk = false;
  }
  stateListeners.forEach((l) => l());
}

const isLength = (n: unknown): n is Length => LENGTHS.includes(n as Length);
const isTime = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;

function parseState(raw: string | null): FocusState {
  if (!raw) return IDLE;
  try {
    const v = JSON.parse(raw) as Record<string, unknown> | null;
    if (!v || !isLength(v.minutes)) return IDLE;
    const minutes = v.minutes;
    if (v.phase === "idle") return isTime(v.afterBreak) ? { phase: "idle", minutes, afterBreak: v.afterBreak } : { phase: "idle", minutes };
    if ((v.phase === "running" || v.phase === "break") && isTime(v.endAt)) return { phase: v.phase, minutes, endAt: v.endAt };
    if (v.phase === "paused" && isTime(v.remainingMs) && v.remainingMs <= minutes * 60_000) return { phase: "paused", minutes, remainingMs: v.remainingMs };
    if (v.phase === "done" && isTime(v.endedAt)) return { phase: "done", minutes, endedAt: v.endedAt, late: v.late === true };
  } catch {
    // Corrupt value: start fresh.
  }
  return { phase: "idle", minutes: 25 };
}

const current = () => parseState(readRaw());

// ---- A shared clock that ticks only while a countdown is on screen.
let clock = 0;
let ticker: ReturnType<typeof setInterval> | null = null;
const clockListeners = new Set<() => void>();
const noopSubscribe = () => () => {};
const readClock = () => clock || (clock = Date.now());

function subscribeClock(listener: () => void) {
  clockListeners.add(listener);
  clock = Date.now();
  ticker ??= setInterval(() => {
    clock = Date.now();
    clockListeners.forEach((l) => l());
  }, 250);
  return () => {
    clockListeners.delete(listener);
    if (!clockListeners.size && ticker) {
      clearInterval(ticker);
      ticker = null;
    }
  };
}

// ---- A gentle chime, synthesized (no audio files). The context is created on a user gesture.
let audio: AudioContext | null = null;

function unlockAudio() {
  try {
    if (!audio) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) audio = new Ctx();
    }
    void audio?.resume().catch(() => undefined);
  } catch {
    audio = null;
  }
}

function chime(soft: boolean) {
  const ctx = audio;
  if (!ctx) return;
  try {
    void ctx.resume().catch(() => undefined);
    const start = ctx.currentTime + 0.05;
    (soft ? [659.25, 523.25] : [523.25, 659.25, 783.99]).forEach((freq, i) => {
      const t = start + i * 0.22;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.14, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 1.5);
    });
  } catch {
    // Audio is a nicety; ignore failures.
  }
}

// ---- Actions (event handlers only).
function pickLength(minutes: Length) {
  writeState({ phase: "idle", minutes });
}

function startFocus() {
  unlockAudio();
  const s = current();
  writeState({ phase: "running", minutes: s.minutes, endAt: Date.now() + s.minutes * 60_000 });
}

function pauseFocus() {
  const s = current();
  if (s.phase === "running") writeState({ phase: "paused", minutes: s.minutes, remainingMs: Math.max(1000, s.endAt - Date.now()) });
}

function resumeFocus() {
  unlockAudio();
  const s = current();
  if (s.phase === "paused") writeState({ phase: "running", minutes: s.minutes, endAt: Date.now() + s.remainingMs });
}

/** Space: start, pause or resume. */
function toggleFocus() {
  const phase = current().phase;
  if (phase === "idle") startFocus();
  else if (phase === "running") pauseFocus();
  else if (phase === "paused") resumeFocus();
}

function startBreak() {
  unlockAudio();
  writeState({ phase: "break", minutes: current().minutes, endAt: Date.now() + BREAK_MINUTES * 60_000 });
}

function stopToIdle() {
  writeState({ phase: "idle", minutes: current().minutes });
}

let finishedEndAt = 0;

const clockText = (ms: number) => {
  const sec = Math.ceil(ms / 1000);
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
};

type LogStatus = "logged" | "already" | "error";

export function FocusTimer({ task, planDone, todayMinutes }: { task: { title: string; minutes: number; href: string } | null; planDone: boolean; todayMinutes: number }) {
  const raw = useSyncExternalStore(subscribeState, readRaw, () => null);
  const state = useMemo(() => parseState(raw), [raw]);
  const ticking = state.phase === "running" || state.phase === "break";
  const now = useSyncExternalStore(ticking ? subscribeClock : noopSubscribe, readClock, () => 0);
  // The End question belongs to the session it was asked about (its stored value); once that
  // session finishes, pauses in another tab or ends, the question is gone.
  const [confirmFor, setConfirmFor] = useState<string | null>(null);
  const [log, setLog] = useState<{ endedAt: number; status: LogStatus } | null>(null);

  const totalMs = (state.phase === "break" ? BREAK_MINUTES : state.minutes) * 60_000;
  const remainingMs =
    state.phase === "running" || state.phase === "break"
      ? Math.min(totalMs, Math.max(0, state.endAt - now))
      : state.phase === "paused"
        ? state.remainingMs
        : state.phase === "done"
          ? 0
          : totalMs;
  const label = clockText(remainingMs);
  const active = state.phase === "running" || state.phase === "paused";
  const confirming = active && confirmFor !== null && confirmFor === raw;

  // Finish a countdown when it reaches zero (also right after a refresh if it ended meanwhile).
  useEffect(() => {
    if ((state.phase !== "running" && state.phase !== "break") || now < state.endAt || finishedEndAt === state.endAt) return;
    finishedEndAt = state.endAt;
    const endedAt = state.endAt;
    const endedAgo = Date.now() - endedAt;
    if (endedAgo > STALE_MS) {
      writeState({ phase: "idle", minutes: state.minutes });
      return;
    }
    if (state.phase === "break") {
      writeState({ phase: "idle", minutes: state.minutes, afterBreak: endedAt });
      if (endedAgo < CHIME_WINDOW_MS) chime(true);
      return;
    }
    const late = endedAgo > LOG_GRACE_MS;
    writeState({ phase: "done", minutes: state.minutes, endedAt, late });
    if (endedAgo < CHIME_WINDOW_MS) chime(false);
    if (late) return;
    completeFocusSession(state.minutes).then(
      (r) => setLog({ endedAt, status: r.ok ? "logged" : "already" }),
      () => setLog({ endedAt, status: "error" }),
    );
  }, [state, now]);

  // A session finished (or a break that ended) long ago: start fresh instead of showing old news.
  useEffect(() => {
    const since = state.phase === "done" ? state.endedAt : state.phase === "idle" ? state.afterBreak : undefined;
    if (since && Date.now() - since > STALE_MS) writeState({ phase: "idle", minutes: state.minutes });
  }, [state]);

  // Keyboard: space starts/pauses, Esc asks to end (and closes the question).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target instanceof HTMLElement ? e.target : null;
      if (el?.closest("input, textarea, select, [contenteditable='true'], [data-ask-ai-panel]")) return;
      if (e.key === "Escape") {
        const stored = readRaw();
        const phase = parseState(stored).phase;
        setConfirmFor((open) => (open !== null && open === stored ? null : phase === "running" || phase === "paused" ? stored : null));
      } else if (e.key === " " && !e.repeat) {
        if (el?.closest("button, a, summary, [role='button']")) return; // the focused control handles space itself
        if (document.querySelector("[role='dialog'][aria-modal='true']")) return; // not behind the End question
        e.preventDefault();
        toggleFocus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // Keep the screen awake during a countdown when the browser allows it.
  useEffect(() => {
    if (!ticking || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let requesting = false;
    let cancelled = false;
    const acquire = () => {
      // The browser drops the lock when the tab is hidden; ask again only when there's none.
      if (requesting || document.visibilityState !== "visible" || (lock && !lock.released)) return;
      requesting = true;
      navigator.wakeLock.request("screen").then(
        (l) => {
          requesting = false;
          if (cancelled) void l.release().catch(() => undefined);
          else lock = l;
        },
        () => {
          requesting = false;
        },
      );
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release().catch(() => undefined);
    };
  }, [ticking]);

  // Show the countdown in the tab title.
  const titleText = active || state.phase === "break" ? `${label} · ${state.phase === "break" ? "Break" : state.phase === "paused" ? "Paused" : "Focus"}` : null;
  useEffect(() => {
    if (!titleText) return;
    const previous = document.title;
    document.title = titleText;
    return () => {
      document.title = previous;
    };
  }, [titleText]);

  const r = 46;
  const c = 2 * Math.PI * r;
  const fraction = totalMs ? remainingMs / totalMs : 0;
  const status =
    state.phase === "running" ? "Focusing" : state.phase === "paused" ? "Paused" : state.phase === "break" ? "Break" : state.phase === "done" ? "Done" : `${state.minutes} min session`;
  const announce = state.phase === "running" ? "Focus session running" : state.phase === "paused" ? "Paused" : state.phase === "break" ? "Break started" : state.phase === "done" ? "Session complete" : "";
  const logStatus = state.phase === "done" && log?.endedAt === state.endedAt ? log.status : null;

  return (
    <main id="main" data-ask-ai="off" className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 pb-[max(env(safe-area-inset-bottom),2rem)] pt-5 sm:px-6 sm:pt-8">
      <header className="flex items-center gap-3">
        <Link
          href="/study"
          aria-label="Back to Study"
          className="group/back inline-flex size-10 shrink-0 items-center justify-center rounded-[12px] border border-border bg-card shadow-card transition-colors hover:border-border-strong"
        >
          <ArrowLeft className="size-[18px] transition-transform group-hover/back:-translate-x-0.5" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold leading-tight tracking-[-0.02em]">Focus</h1>
          <p className="truncate text-sm text-muted">Just you and your practice</p>
        </div>
        <Chip>{todayMinutes ? `Today · ${todayMinutes} min` : "Rest day"}</Chip>
      </header>

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      <section className="flex flex-1 flex-col items-center justify-center py-8" aria-label="Focus timer">
        {state.phase === "idle" ? (
          <div role="group" aria-label="Session length" className="mb-8 grid w-full max-w-xs grid-cols-3 gap-1 rounded-[14px] bg-subtle p-1">
            {LENGTHS.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={state.minutes === m}
                onClick={() => pickLength(m)}
                className={cn("h-10 rounded-[11px] text-sm font-medium transition-colors", state.minutes === m ? "bg-card text-fg shadow-card" : "text-muted hover:text-fg")}
              >
                <span className="font-mono tabular">{m}</span> min
              </button>
            ))}
          </div>
        ) : null}

        <div role="timer" aria-label={`${clockText(remainingMs)} left`} className="relative aspect-square w-[min(78vw,20rem)]">
          <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
            <circle cx="50" cy="50" r={r} fill="none" stroke="var(--subtle-2)" strokeWidth="3" />
            {fraction > 0 ? (
              <circle
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - fraction)}
                className={cn(ticking && "transition-[stroke-dashoffset] duration-300 ease-linear")}
              />
            ) : null}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {state.phase === "done" ? (
              <span className="pop-in inline-flex size-16 items-center justify-center rounded-full bg-accent text-accent-fg">
                <Check className="size-8" aria-hidden />
              </span>
            ) : (
              <span className={cn("font-mono text-[4rem] font-medium leading-none tracking-[-0.04em] tabular sm:text-[5.25rem]", state.phase === "paused" && "text-muted")}>{label}</span>
            )}
            <span className="eyebrow mt-3">{status}</span>
          </div>
        </div>

        <div className="mt-8 flex w-full max-w-sm flex-col items-center gap-3">
          {state.phase === "idle" ? (
            <>
              {state.afterBreak ? <p className="text-center text-[15px] text-muted">Break&apos;s over. Ready for another round?</p> : null}
              <Button variant="accent" size="lg" block onClick={startFocus}>
                <Play className="size-4" aria-hidden /> Start focus
              </Button>
            </>
          ) : null}
          {active ? (
            <div className="grid w-full grid-cols-2 gap-3">
              {state.phase === "running" ? (
                <Button variant="outline" size="lg" onClick={pauseFocus}>
                  <Pause className="size-4" aria-hidden /> Pause
                </Button>
              ) : (
                <Button variant="accent" size="lg" onClick={resumeFocus}>
                  <Play className="size-4" aria-hidden /> Resume
                </Button>
              )}
              <Button variant="ghost" size="lg" onClick={() => setConfirmFor(raw)}>
                End
              </Button>
            </div>
          ) : null}
          {state.phase === "done" ? (
            <Card className="w-full text-center">
              <h2 className="text-lg font-semibold tracking-[-0.02em]">Nice work. Session complete.</h2>
              <p className="mt-1 text-sm text-muted">
                {state.late
                  ? "It ended while you were away, so it wasn't logged."
                  : logStatus === "logged"
                    ? "Logged for today's streak."
                    : logStatus === "already"
                      ? "Already counted for today."
                      : logStatus === "error"
                        ? "We couldn't log it. Check your connection."
                        : "Stand up, stretch, look away from the screen."}
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={stopToIdle}>
                  Skip break
                </Button>
                <Button variant="accent" onClick={startBreak}>
                  <Coffee className="size-4" aria-hidden /> {BREAK_MINUTES}-min break
                </Button>
              </div>
            </Card>
          ) : null}
          {state.phase === "break" ? (
            <>
              <p className="text-center text-[15px] text-muted">Stand up, stretch, get some water.</p>
              <Button variant="outline" size="lg" block onClick={stopToIdle}>
                End break
              </Button>
            </>
          ) : null}
        </div>
      </section>

      {state.phase !== "break" ? (
        task ? (
          <div>
            <Link href={task.href} className="group block rounded-[24px] border border-border bg-card p-5 shadow-card transition-colors hover:border-border-strong">
              <p className="eyebrow">Up next today</p>
              <div className="mt-2 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold leading-snug tracking-[-0.02em]">{task.title}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    <span className="font-mono tabular">{task.minutes}</span> min
                  </p>
                </div>
                <ArrowRight className="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
              </div>
            </Link>
            {active ? <p className="mt-2.5 text-center text-sm text-muted">Your timer keeps running while you practice. Come back here when it ends.</p> : null}
          </div>
        ) : (
          <p className="text-center text-sm text-muted">{planDone ? "Today's plan is done. Use this time to review." : "No plan for today yet. Pick any practice from Study."}</p>
        )
      ) : null}

      <p className="mt-5 hidden text-center font-mono text-xs text-muted sm:block">
        <kbd className="rounded-[6px] border border-border px-1.5 py-0.5">Space</kbd> start / pause · <kbd className="rounded-[6px] border border-border px-1.5 py-0.5">Esc</kbd> end
      </p>

      {confirming ? (
        <div role="dialog" aria-modal="true" aria-labelledby="end-focus-title" className="fixed inset-0 z-50 flex items-end justify-center bg-hero/50 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-[24px] border border-border bg-card p-6 shadow-float">
            <h2 id="end-focus-title" className="text-xl font-semibold tracking-[-0.02em]">
              End this session?
            </h2>
            <p className="mt-2 text-muted">Only finished sessions count toward today&apos;s streak.</p>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" className="flex-1" autoFocus onClick={() => setConfirmFor(null)}>
                Keep going
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={() => {
                  setConfirmFor(null);
                  stopToIdle();
                }}
              >
                End session
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
