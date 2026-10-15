"use client";
import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ShareLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-7 border-t border-hero-line pt-6">
      <p className="break-all rounded-[14px] border border-hero-line px-4 py-3 font-mono text-sm text-hero-fg">{link}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button variant="hero" onClick={async () => { await navigator.clipboard.writeText(link); setCopied(true); }}>
          {copied ? <Check className="pop-in size-4" strokeWidth={3} aria-hidden /> : <Copy className="size-4" aria-hidden />} {copied ? "Copied" : "Copy link"}
        </Button>
        <Button variant="accent" onClick={() => navigator.share?.({ title: "PrepX", text: "Study for DECA, FBLA, HOSA or TSA with me on PrepX", url: link }).catch(() => undefined)}>
          <Share2 className="size-4" aria-hidden /> Share
        </Button>
      </div>
    </div>
  );
}
