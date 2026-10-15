"use client";
import { useState } from "react";
import { Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/toggle";
import { cn } from "@/lib/cn";

const TYPES = [
  ["streak", "Streak"],
  ["level", "Level"],
  ["sprint", "Sprint best"],
] as const;

export function ShareCards() {
  const [type, setType] = useState<(typeof TYPES)[number][0]>("streak");
  const [name, setName] = useState(false);
  const src = `/api/share/card?type=${type}${name ? "&name=1" : ""}`;
  const share = async () => {
    const blob = await (await fetch(src)).blob();
    const file = new File([blob], `prepx-${type}.png`, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: "My PrepX progress" }).catch(() => undefined);
    else window.open(src, "_blank");
  };
  return (
    <div className="mt-5 space-y-3">
      <div role="tablist" aria-label="Card type" className="grid grid-cols-3 gap-1 rounded-[16px] border border-border bg-subtle/80 p-1">
        {TYPES.map(([t, l]) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={type === t}
            onClick={() => setType(t)}
            className={cn("h-10 rounded-[12px] text-sm font-medium transition-colors", type === t ? "bg-card text-fg shadow-card" : "text-muted hover:text-fg")}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-4 rounded-[16px] border border-border bg-card px-4 py-3 shadow-card">
        <span className="text-sm font-medium" aria-hidden>
          Show my first name
        </span>
        <Switch checked={name} label="Show my first name" onToggle={() => setName(!name)} />
      </div>
      <div className="flex justify-center rounded-[24px] bg-subtle px-4 py-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={`Share card: ${type}`} className="aspect-[9/16] w-60 rounded-[20px] bg-hero object-cover shadow-float sm:w-64" />
      </div>
      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <Button variant="accent" onClick={share}>
          <Share2 className="size-4" aria-hidden /> Share
        </Button>
        <a
          href={src}
          download={`prepx-${type}.png`}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-[14px] border border-border-strong bg-card px-5 text-[15px] font-medium tracking-[-0.01em] text-fg transition-colors hover:border-fg/40 hover:bg-subtle/60"
        >
          <Download className="size-4" aria-hidden /> Download
        </a>
      </div>
    </div>
  );
}
