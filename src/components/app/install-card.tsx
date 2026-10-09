"use client";
import { useEffect, useState } from "react";
import { useClientValue } from "@/lib/use-client-value";
import { Download, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const KEY = "prepx-install-dismissed";

export function InstallCard() {
  const [evt, setEvt] = useState<BIP | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const eligible = useClientValue(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as { standalone?: boolean }).standalone);
    let seen = false;
    try {
      seen = Boolean(localStorage.getItem(KEY));
    } catch {}
    return !standalone && !seen;
  }, false);
  const ios = useClientValue(() => /iphone|ipad|ipod/i.test(navigator.userAgent), false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIP);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!eligible || dismissed || (!ios && !evt)) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
    setDismissed(true);
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
