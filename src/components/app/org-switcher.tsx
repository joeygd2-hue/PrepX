"use client";
import { useOptimistic, useTransition } from "react";
import { ORGS, ORG_IDS, type OrgId } from "@/lib/orgs";
import { cn } from "@/lib/cn";
import { setFocusOrg } from "@/app/actions/study";

export function OrgSwitcher({ value }: { value: OrgId }) {
  const [opt, setOpt] = useOptimistic(value);
  const [, start] = useTransition();
  const index = ORG_IDS.indexOf(opt);
  return (
    <div role="tablist" aria-label="Organization" className="relative grid grid-cols-4 rounded-[16px] border border-border bg-subtle/80 p-1">
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/4)] rounded-[12px] bg-card shadow-card transition-transform duration-300 ease-[cubic-bezier(.2,.7,.2,1)]"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {ORG_IDS.map((o) => (
        <button
          key={o}
          role="tab"
          aria-selected={opt === o}
          type="button"
          onClick={() => start(async () => { setOpt(o); await setFocusOrg(o); })}
          className={cn("relative z-[1] flex h-10 items-center justify-center gap-2 rounded-[12px] font-mono text-xs font-semibold tracking-wider transition-colors", opt === o ? "text-fg" : "text-muted hover:text-fg")}
        >
          <span className="size-1.5 rounded-full" style={{ background: `var(--${o})` }} aria-hidden />
          {ORGS[o].name}
        </button>
      ))}
    </div>
  );
}
