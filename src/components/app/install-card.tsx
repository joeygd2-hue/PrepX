"use client";
import { useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const KEY = "prepx-install-dismissed";

export function InstallCard() {
  const [evt, setEvt] = useState<BIP | null>(null);
  const [ios, setIos] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
    if (standalone || localStorage.getItem(KEY)) return;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIos(isIos);
    if (isIos) setShow(true);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIP);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!show) return null;
  const dismiss = () => {
    localStorage.setItem(KEY, "1");
    setShow(false);
  };
  return (
    <section aria-label="Install PrepX" className="rounded-3xl border border-border p-5">
      <div className="flex items-start gap-3">
        <Smartphone className="mt-0.5 size-6 shrink-0" aria-hidden />
        <div className="flex-1">
          <p className="font-semibold">Add PrepX to your Home Screen</p>
          <p className="text-sm text-muted">Opens like an app and can send check-in and announcement alerts.</p>
        </div>
        <button type="button" onClick={dismiss} aria-label="Dismiss" className="rounded-full p-1 hover:bg-subtle">
          <X className="size-5" aria-hidden />
        </button>
      </div>
      {ios && !evt ? (
        <p className="mt-4 rounded-2xl bg-subtle px-4 py-3 text-sm">
          In Safari, tap <strong>Share</strong> then <strong>Add to Home Screen</strong>.
        </p>
      ) : (
        <Button
          block
          className="mt-4"
          onClick={async () => {
            if (!evt) return;
            await evt.prompt();
            const choice = await evt.userChoice;
            if (choice.outcome === "accepted") dismiss();
          }}
        >
          <Download className="size-4" aria-hidden /> Install
        </Button>
      )}
    </section>
  );
}
