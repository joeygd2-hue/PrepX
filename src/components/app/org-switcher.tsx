"use client";
import { useOptimistic, useTransition } from "react";
import { ORGS, ORG_IDS, type OrgId } from "@/lib/orgs";
import { cn } from "@/lib/cn";
import { setFocusOrg } from "@/app/actions/study";
import { useOrgThemeSwitch } from "./org-theme";

/** Segmented organization picker: a pill slides to the choice and the area re-themes at once. */
export function OrgSwitcher({ value }: { value: OrgId }) {
  const [opt, setOpt] = useOptimistic(value);
  const [pending, start] = useTransition();
  const setTheme = useOrgThemeSwitch();
  const index = ORG_IDS.indexOf(opt);
  const choose = (o: OrgId) => {
    if (o === opt) return;
    start(async () => {
      setOpt(o);
      setTheme?.(o);
      await setFocusOrg(o);
    });
  };
  return (
    <div role="tablist" aria-label="Organization" aria-busy={pending} className="relative grid grid-cols-4 rounded-[16px] border border-border bg-subtle/80 p-1">
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/4)] rounded-[12px] bg-accent shadow-[0_8px_22px_-12px_var(--accent)] transition-transform duration-500 ease-[cubic-bezier(.3,1.35,.4,1)]"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {ORG_IDS.map((o) => {
        const active = opt === o;
        return (
          <button
            key={o}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => choose(o)}
            className={cn(
              "group/tab relative z-[1] flex h-11 items-center justify-center gap-2 rounded-[12px] font-mono text-xs font-semibold tracking-wider transition-[color,background-color,transform] duration-200 active:scale-[0.96]",
              active ? "text-accent-fg" : "text-muted hover:bg-card/70 hover:text-fg",
            )}
          >
            <span
              aria-hidden
              className="size-1.5 rounded-full transition-transform duration-200 group-hover/tab:scale-150"
              style={{ background: active ? "var(--accent-fg)" : `var(--${o})` }}
            />
            {ORGS[o].name}
          </button>
        );
      })}
    </div>
  );
}
