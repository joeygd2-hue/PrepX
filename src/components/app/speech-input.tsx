"use client";
import { useEffect, useRef, useState } from "react";
import { useClientValue } from "@/lib/use-client-value";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";

type SR = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

/**
 * Voice-to-text using the browser's built-in speech recognition. PrepX never receives
 * audio — only the text transcript, which the student can edit before submitting.
 */
export function SpeechInput({
  value,
  onChange,
  placeholder,
  rows = 8,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  label: string;
}) {
  const supported = useClientValue<boolean | null>(() => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    return Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition);
  }, null);
  const storedConsent = useClientValue(() => {
    try {
      return localStorage.getItem("prepx-mic-ok") === "1";
    } catch {
      return false;
    }
  }, false);
  const [consentGiven, setConsented] = useState(false);
  const consented = storedConsent || consentGiven;
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<SR | null>(null);
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  useEffect(() => () => rec.current?.stop(), []);

  const start = () => {
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";
    r.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interimText += res[0].transcript;
      }
      if (finalText) onChange(`${valueRef.current}${valueRef.current && !valueRef.current.endsWith(" ") ? " " : ""}${finalText.trim()}`);
      setInterim(interimText);
    };
    r.onerror = (e) => {
      setError(e.error === "not-allowed" ? "Microphone permission was denied. You can type your response instead, or allow the microphone in your browser settings." : "Voice input stopped. You can keep typing or try again.");
      setListening(false);
    };
    r.onend = () => {
      setListening(false);
      setInterim("");
    };
    rec.current = r;
    setError(null);
    r.start();
    setListening(true);
  };

  return (
    <div>
      <label className="mb-2 block text-sm font-medium" htmlFor="speech-text">
        {label}
      </label>
      <Textarea id="speech-text" rows={rows} value={value + (interim ? ` ${interim}` : "")} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-describedby="speech-help" />
      <div id="speech-help" className="mt-3">
        {supported === false ? (
          <p className="text-sm text-muted">Voice input isn&apos;t supported in this browser. Type your response, or try Chrome, Edge or Safari.</p>
        ) : supported && !consented ? (
          <div className="rounded-[16px] border border-border bg-subtle/70 p-4 text-sm leading-relaxed">
            <p>
              <strong>Speak instead of typing?</strong> Your browser will ask for microphone access. Speech is converted to text by your browser&apos;s speech service (in Chrome, Google
              processes the audio). PrepX never receives or stores audio, only the text you submit.
            </p>
            <Button
              type="button"
              size="sm"
              className="mt-3"
              onClick={() => {
                try {
                  localStorage.setItem("prepx-mic-ok", "1");
                } catch {}
                setConsented(true);
                start();
              }}
            >
              <Mic className="size-4" aria-hidden /> Use my microphone
            </Button>
          </div>
        ) : supported ? (
          <Button type="button" size="sm" variant={listening ? "danger" : "outline"} onClick={() => (listening ? rec.current?.stop() : start())} aria-pressed={listening}>
            {listening ? <MicOff className="size-4" aria-hidden /> : <Mic className="size-4" aria-hidden />}
            {listening ? "Stop listening" : "Speak"}
          </Button>
        ) : null}
        {listening ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted" role="status">
            <span aria-hidden className="relative inline-flex size-2.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-accent shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--fg)_25%,transparent)]" />
            </span>
            Listening… speak naturally. You can edit the text afterwards.
          </p>
        ) : null}
        {error ? (
          <p className="mt-2 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
