"use client";
import { useState } from "react";
import { Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    <div className="mt-5">
      <div role="tablist" className="flex gap-2">
        {TYPES.map(([t, l]) => (
          <button key={t} role="tab" aria-selected={type === t} onClick={() => setType(t)} className={`rounded-full px-4 py-2 text-sm font-medium ${type === t ? "bg-fg text-bg" : "bg-subtle"}`}>
            {l}
          </button>
        ))}
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={name} onChange={(e) => setName(e.target.checked)} className="size-4 accent-[var(--fg)]" /> Show my first name
      </label>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={`Share card: ${type}`} className="mx-auto mt-5 aspect-[9/16] w-64 rounded-3xl border border-border object-cover" />
      <div className="mt-5 flex justify-center gap-3">
        <Button onClick={share}>
          <Share2 className="size-4" aria-hidden /> Share
        </Button>
        <a href={src} download={`prepx-${type}.png`} className="inline-flex h-12 items-center gap-2 rounded-full border border-border px-6 font-medium hover:bg-subtle">
          <Download className="size-4" aria-hidden /> Download
        </a>
      </div>
    </div>
  );
}
