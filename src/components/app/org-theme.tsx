"use client";
import { createContext, useContext, useEffect, useOptimistic } from "react";
import type { OrgId } from "@/lib/orgs";

const OrgThemeContext = createContext<((org: OrgId) => void) | null>(null);

/**
 * Applies an organization's color theme to its subtree (see `[data-org]` in globals.css).
 * With `sync`, the whole page (navigation dock and background glow) follows too, for as
 * long as this scope is mounted. The theme can be switched optimistically from inside a
 * transition with `useOrgThemeSwitch()`, before the server confirms.
 */
export function OrgScope({ org, sync, children }: { org: OrgId; sync?: boolean; children: React.ReactNode }) {
  const [current, setCurrent] = useOptimistic(org);
  useEffect(() => {
    if (!sync) return;
    const root = document.documentElement;
    root.dataset.org = current;
    return () => {
      delete root.dataset.org;
    };
  }, [current, sync]);
  return (
    <OrgThemeContext.Provider value={setCurrent}>
      <div data-org={current} className="org-theme">
        {children}
      </div>
    </OrgThemeContext.Provider>
  );
}

/** Optimistic theme setter; call it inside the same transition as the server action. */
export function useOrgThemeSwitch() {
  return useContext(OrgThemeContext);
}
