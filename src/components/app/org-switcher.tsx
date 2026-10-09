"use client";
import { useOptimistic, useTransition } from "react";
import { ORGS, ORG_IDS, type OrgId } from "@/lib/orgs";
import { cn } from "@/lib/cn";
import { setFocusOrg } from "@/app/actions/study";

export function OrgSwitcher({ value }: { value: OrgId }) {
  const [opt, setOpt] = useOptimistic(value);
  const [, start] = useTransition();
  return (
    <div role="tablist" aria-label="Organization" className="grid grid-cols-4 gap-1 rounded-full bg-subtle p-1">
      {ORG_IDS.map((o) => (
        <button
          key={o}
          role="tab"
          aria-selected={opt === o}
          type="button"
          onClick={() => start(async () => { setOpt(o); await setFocusOrg(o); })}
          className={cn("flex h-10 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors", opt === o ? "bg-fg text-bg" : "hover:bg-subtle-2")}
        >
          <span className="size-1.5 rounded-full" style={{ background: ORGS[o].color }} aria-hidden />
          {ORGS[o].name}
        </button>
      ))}
    </div>
  );
}
