"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, CameraOff, Loader2, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { SpeechInput } from "@/components/app/speech-input";
import { BackHeader } from "@/components/ui/page";
import { submitJudgeRun } from "@/app/actions/ai";
import { cn } from "@/lib/cn";

type Scenario = { title: string; studentRole: string; judgeRole: string; situation: string; task: string; indicators: string[]; judgeQuestions: string[]; prepSec: number; performSec: number };
type Phase = "brief" | "prep" | "perform";

function fmt(s: number) {
  const v = Math.max(0, s);
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
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
  return (
    <main id="main" className="mx-auto max-w-2xl px-4 pb-32 pt-6 sm:px-6">
      <BackHeader href="/study/judge" title={scenario.title} subtitle={eventLabel} />
      {phase !== "brief" ? (
        <div className={cn("sticky top-2 z-10 mb-4 flex items-center justify-between rounded-full px-5 py-3", over ? "bg-danger text-white" : "bg-fg text-bg")} role="timer">
          <span className="inline-flex items-center gap-2 text-sm font-medium">
            <Timer className="size-4" aria-hidden /> {phase === "prep" ? "Prep time" : over ? "Time's up — wrap up" : "With the judge"}
          </span>
          <span className="text-lg font-semibold tabular">{phase === "prep" ? fmt(prepLeft) : fmt(scenario.performSec - elapsed)}</span>
        </div>
      ) : null}

      <section className="space-y-4 rounded-3xl border border-border p-5 sm:p-6">
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted">You are:</span> <span className="font-medium">{scenario.studentRole}</span>
          </p>
          <p>
            <span className="text-muted">The judge is:</span> <span className="font-medium">{scenario.judgeRole}</span>
          </p>
        </div>
        <div>
          <h2 className="font-semibold">Situation</h2>
          <p className="mt-1 whitespace-pre-wrap text-muted">{scenario.situation}</p>
        </div>
        <div>
          <h2 className="font-semibold">Your task</h2>
          <p className="mt-1">{scenario.task}</p>
        </div>
        {scenario.indicators.length ? (
          <div>
            <h2 className="font-semibold">Performance indicators</h2>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {scenario.indicators.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="text-xs text-muted">Original AI-written practice scenario. Not an official competition event.</p>
      </section>

      {phase === "brief" ? (
        <div className="mt-6 space-y-3">
          {scenario.prepSec > 0 ? (
            <Button block size="lg" onClick={() => setPhase("prep")}>
              Start {Math.round(scenario.prepSec / 60)}-minute prep
            </Button>
          ) : null}
          <Button block size="lg" variant={scenario.prepSec > 0 ? "outline" : "primary"} onClick={() => setPhase("perform")}>
            {scenario.prepSec > 0 ? "Skip prep, start now" : "Start"}
          </Button>
        </div>
      ) : null}

      {phase === "prep" ? (
        <div className="mt-6">
          <label htmlFor="notes" className="mb-2 block text-sm font-medium">
            Prep notes (stay on this device, not submitted)
          </label>
          <Textarea id="notes" rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Outline your opening, key points for each indicator, and a strong close." />
          <Button block size="lg" className="mt-4" onClick={() => setPhase("perform")}>
            I&apos;m ready, start with the judge
          </Button>
        </div>
      ) : null}

      {phase === "perform" ? (
        <div className="mt-6 space-y-5">
          {face ? (
            <section className="rounded-3xl border border-border p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold">Camera</h2>
                <Button size="sm" variant="outline" onClick={toggleCamera} aria-pressed={camOn}>
                  {camOn ? <CameraOff className="size-4" aria-hidden /> : <Camera className="size-4" aria-hidden />} {camOn ? "Turn off" : "Turn on"}
                </Button>
              </div>
              <video ref={video} autoPlay playsInline muted className={cn("mt-3 aspect-video w-full -scale-x-100 rounded-2xl bg-subtle object-cover", !camOn && "hidden")} aria-label="Your camera preview" />
              <p className="mt-3 text-sm text-muted">The preview stays on your device. Video is never recorded or uploaded.</p>
              <label className="mt-3 flex items-start gap-3 text-sm">
                <input type="checkbox" checked={shareStills} onChange={(e) => setShareStills(e.target.checked)} className="mt-0.5 size-5 accent-[var(--fg)]" disabled={!camOn} />
                <span>Share up to 3 still photos with the AI judge for body-language feedback. They&apos;re used for this feedback only and not stored.</span>
              </label>
            </section>
          ) : null}
          <SpeechInput value={transcript} onChange={setTranscript} label="Your response (speak or type)" placeholder="Greet the judge, state your recommendation, then cover each performance indicator…" rows={10} />
          {scenario.judgeQuestions.length ? (
            showQuestions ? (
              <section className="rounded-3xl bg-subtle p-5" aria-live="polite">
                <h2 className="font-semibold">The judge asks</h2>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {scenario.judgeQuestions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
                <p className="mt-2 text-sm text-muted">Answer out loud; your answers are added to the transcript.</p>
              </section>
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
          <Button block size="lg" disabled={pending || transcript.trim().length < 1} onClick={submit}>
            {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
            {pending ? "The judge is scoring…" : "Finish and get feedback"}
          </Button>
          <p className="text-center text-xs text-muted">Your transcript is sent to our AI provider for scoring and saved with your feedback.</p>
        </div>
      ) : null}
    </main>
  );
}
