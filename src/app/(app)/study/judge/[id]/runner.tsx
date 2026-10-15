"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowRight, Camera, CameraOff, Loader2, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label, Textarea } from "@/components/ui/form";
import { SpeechInput } from "@/components/app/speech-input";
import { BackHeader, Page } from "@/components/ui/page";
import { submitJudgeRun } from "@/app/actions/ai";
import { cn } from "@/lib/cn";

type Scenario = { title: string; studentRole: string; judgeRole: string; situation: string; task: string; indicators: string[]; judgeQuestions: string[]; prepSec: number; performSec: number };
type Phase = "brief" | "prep" | "perform";

function fmt(s: number) {
  const v = Math.max(0, s);
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
}

/** Two-digit mono index used for numbered lists in the scenario. */
function Num({ n, className }: { n: number; className?: string }) {
  return (
    <span aria-hidden className={cn("mt-0.5 shrink-0 font-mono text-xs text-muted tabular", className)}>
      {String(n).padStart(2, "0")}
    </span>
  );
}

export function JudgeRunner({ sessionId, face, scenario, eventLabel }: { sessionId: string; face: boolean; scenario: Scenario; eventLabel: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("brief");
  const [prepLeft, setPrepLeft] = useState(scenario.prepSec);
  const [elapsed, setElapsed] = useState(0);
  const [notes, setNotes] = useState("");
  const [transcript, setTranscript] = useState("");
  const [showQuestions, setShowQuestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Camera (face-to-face only)
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [camOn, setCamOn] = useState(false);
  const [shareStills, setShareStills] = useState(false);
  const stills = useRef<{ mediaType: "image/jpeg"; base64: string }[]>([]);

  useEffect(() => {
    if (phase !== "prep") return;
    const t = setInterval(() => {
      setPrepLeft((x) => {
        if (x <= 1) {
          clearInterval(t);
          setPhase("perform");
          return 0;
        }
        return x - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "perform") return;
    const t = setInterval(() => setElapsed((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // Capture up to 3 stills at 20%, 50% and 80% of the allotted time, only with consent.
  useEffect(() => {
    if (!camOn || !shareStills || phase !== "perform") return;
    const marks = [0.2, 0.5, 0.8].map((f) => Math.round(f * scenario.performSec));
    if (marks.includes(elapsed) && stills.current.length < 3 && video.current) {
      const v = video.current;
      const c = document.createElement("canvas");
      c.width = 640;
      c.height = Math.round((v.videoHeight / Math.max(v.videoWidth, 1)) * 640) || 480;
      c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
      const data = c.toDataURL("image/jpeg", 0.6).split(",")[1];
      if (data) stills.current.push({ mediaType: "image/jpeg", base64: data });
    }
  }, [elapsed, camOn, shareStills, phase, scenario.performSec]);

  useEffect(
    () => () => {
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  const toggleCamera = async () => {
    if (camOn) {
      stream.current?.getTracks().forEach((t) => t.stop());
      setCamOn(false);
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      if (video.current) video.current.srcObject = stream.current;
      setCamOn(true);
    } catch {
      setError("Camera permission was denied. You can still practice with voice or text.");
    }
  };

  const submit = () =>
    start(async () => {
      setError(null);
      const r = await submitJudgeRun(sessionId, { transcript, durationSec: elapsed, images: shareStills ? stills.current : undefined });
      if (!r.ok) setError(r.error);
      else {
        stream.current?.getTracks().forEach((t) => t.stop());
        router.refresh();
      }
    });

  const over = phase === "perform" && elapsed >= scenario.performSec;
  // Share of the current phase's time already used, for the pill's progress line.
  const used = phase === "prep" ? 1 - prepLeft / Math.max(scenario.prepSec, 1) : elapsed / Math.max(scenario.performSec, 1);
  return (
    <Page>
      <BackHeader href="/study/judge" title={scenario.title} subtitle={eventLabel} />
      {phase !== "brief" ? (
        <div
          className={cn(
            "sticky top-3 z-20 mb-5 overflow-hidden rounded-full px-5 py-2.5 shadow-float transition-colors duration-300",
            over ? "bg-danger text-white" : "bg-hero text-hero-fg",
          )}
          role="timer"
        >
          <div className="flex items-center justify-between gap-3">
            <span className={cn("inline-flex min-w-0 items-center gap-2 text-sm font-medium", !over && "text-hero-muted")}>
              <Timer className="size-4 shrink-0" aria-hidden /> {phase === "prep" ? "Prep time" : over ? "Time's up — wrap up" : "With the judge"}
            </span>
            <span className="font-mono text-[1.75rem] font-medium leading-none tracking-[-0.04em] tabular">{phase === "prep" ? fmt(prepLeft) : fmt(scenario.performSec - elapsed)}</span>
          </div>
          <span aria-hidden className={cn("absolute inset-x-0 bottom-0 h-[3px]", over ? "bg-current/25" : "bg-hero-line")}>
            <span className={cn("block h-full transition-[width] duration-1000 ease-linear", over ? "bg-current" : "bg-accent")} style={{ width: `${Math.min(100, Math.max(0, used * 100))}%` }} />
          </span>
        </div>
      ) : null}

      <Card className="p-0 sm:p-0">
        <dl className="grid divide-y divide-border border-b border-border text-sm sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <div className="px-5 py-4 sm:px-6">
            <dt className="text-muted">You are:</dt>
            <dd className="mt-0.5 font-medium">{scenario.studentRole}</dd>
          </div>
          <div className="px-5 py-4 sm:px-6">
            <dt className="text-muted">The judge is:</dt>
            <dd className="mt-0.5 font-medium">{scenario.judgeRole}</dd>
          </div>
        </dl>
        <div className="space-y-7 px-5 py-6 sm:px-6 sm:py-7">
          <section>
            <h2 className="eyebrow">Situation</h2>
            <p className="mt-2.5 whitespace-pre-wrap text-[15px] leading-relaxed text-fg/85">{scenario.situation}</p>
          </section>
          <section>
            <h2 className="eyebrow">Your task</h2>
            <p className="mt-2.5 border-l-2 border-fg pl-4 text-[17px] font-medium leading-snug tracking-[-0.01em]">{scenario.task}</p>
          </section>
          {scenario.indicators.length ? (
            <section>
              <h2 className="eyebrow">Performance indicators</h2>
              <ol className="mt-3 divide-y divide-border">
                {scenario.indicators.map((ind, i) => (
                  <li key={ind} className="flex gap-4 py-3 text-[15px] leading-snug first:pt-0 last:pb-0">
                    <Num n={i + 1} />
                    <span>{ind}</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>
        <p className="border-t border-border px-5 py-3.5 text-xs text-muted sm:px-6">Original AI-written practice scenario. Not an official competition event.</p>
      </Card>

      {phase === "brief" ? (
        <div className="mt-6 space-y-3">
          {scenario.prepSec > 0 ? (
            <Button block size="lg" variant="accent" onClick={() => setPhase("prep")}>
              <Timer className="size-5" aria-hidden /> Start {Math.round(scenario.prepSec / 60)}-minute prep
            </Button>
          ) : null}
          <Button block size="lg" variant={scenario.prepSec > 0 ? "outline" : "accent"} onClick={() => setPhase("perform")}>
            {scenario.prepSec > 0 ? "Skip prep, start now" : "Start"}
          </Button>
        </div>
      ) : null}

      {phase === "prep" ? (
        <div className="mt-6">
          <Label htmlFor="notes">Prep notes (stay on this device, not submitted)</Label>
          <Textarea id="notes" rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Outline your opening, key points for each indicator, and a strong close." />
          <Button block size="lg" variant="accent" className="mt-4" onClick={() => setPhase("perform")}>
            I&apos;m ready, start with the judge <ArrowRight className="size-5 transition-transform group-hover/btn:translate-x-0.5" aria-hidden />
          </Button>
        </div>
      ) : null}

      {phase === "perform" ? (
        <div className="mt-6 space-y-5">
          {face ? (
            <Card>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold tracking-[-0.02em]">Camera</h2>
                <Button size="sm" variant="outline" onClick={toggleCamera} aria-pressed={camOn}>
                  {camOn ? <CameraOff className="size-4" aria-hidden /> : <Camera className="size-4" aria-hidden />} {camOn ? "Turn off" : "Turn on"}
                </Button>
              </div>
              <video
                ref={video}
                autoPlay
                playsInline
                muted
                className={cn("mt-4 aspect-video w-full -scale-x-100 rounded-[16px] bg-subtle object-cover", !camOn && "hidden")}
                aria-label="Your camera preview"
              />
              <p className="mt-3 text-sm text-muted">The preview stays on your device. Video is never recorded or uploaded.</p>
              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-[16px] border border-border bg-card p-4 text-sm leading-relaxed transition-colors hover:border-border-strong has-[:checked]:border-fg has-[:checked]:ring-4 has-[:checked]:ring-accent/30 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
                <input type="checkbox" checked={shareStills} onChange={(e) => setShareStills(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-primary" disabled={!camOn} />
                <span>Share up to 3 still photos with the AI judge for body-language feedback. They&apos;re used for this feedback only and not stored.</span>
              </label>
            </Card>
          ) : null}
          <SpeechInput value={transcript} onChange={setTranscript} label="Your response (speak or type)" placeholder="Greet the judge, state your recommendation, then cover each performance indicator…" rows={10} />
          {scenario.judgeQuestions.length ? (
            showQuestions ? (
              <Card tone="subtle" aria-live="polite">
                <h2 className="eyebrow">The judge asks</h2>
                <ol className="mt-4 space-y-3">
                  {scenario.judgeQuestions.map((q, i) => (
                    <li key={q} className="flex gap-4 text-[15px] leading-relaxed">
                      <Num n={i + 1} className="mt-1" />
                      <span>{q}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-4 text-sm text-muted">Answer out loud; your answers are added to the transcript.</p>
              </Card>
            ) : (
              <Button variant="outline" block onClick={() => setShowQuestions(true)}>
                I&apos;ve finished presenting, ask me questions
              </Button>
            )
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <Button block size="lg" variant="accent" disabled={pending || transcript.trim().length < 1} onClick={submit}>
            {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
            {pending ? "The judge is scoring…" : "Finish and get feedback"}
          </Button>
          <p className="text-center text-xs text-muted">Your transcript is sent to our AI provider for scoring and saved with your feedback.</p>
        </div>
      ) : null}
    </Page>
  );
}
