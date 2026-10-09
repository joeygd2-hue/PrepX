"use client";
import { useState } from "react";
import { Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ShareLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-6 rounded-3xl border border-border p-5">
      <p className="break-all font-mono text-sm">{link}</p>
      <div className="mt-4 flex gap-3">
        <Button variant="outline" onClick={async () => { await navigator.clipboard.writeText(link); setCopied(true); }}>
          <Copy className="size-4" aria-hidden /> {copied ? "Copied" : "Copy link"}
        </Button>
        <Button onClick={() => navigator.share?.({ title: "PrepX", text: "Study for DECA, FBLA, HOSA or TSA with me on PrepX", url: link }).catch(() => undefined)}>
          <Share2 className="size-4" aria-hidden /> Share
        </Button>
      </div>
    </div>
  );
}
