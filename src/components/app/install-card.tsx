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
    <section aria-label="Install PrepX" className="relative overflow-hidden rounded-[24px] border border-border bg-card p-5 shadow-card">
      <div className="flex items-start gap-3.5">
        <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-accent text-accent-fg">
          <Smartphone className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold tracking-[-0.01em]">Add PrepX to your Home Screen</p>
          <p className="mt-0.5 text-sm text-muted">Opens like an app and can send check-in and announcement alerts.</p>
        </div>
        <button type="button" onClick={dismiss} aria-label="Dismiss" className="-m-1 rounded-full p-1.5 text-muted transition-colors hover:bg-subtle hover:text-fg">
          <X className="size-[18px]" aria-hidden />
        </button>
      </div>
      {ios && !evt ? (
        <p className="mt-4 rounded-[14px] bg-subtle px-4 py-3 text-sm">
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
