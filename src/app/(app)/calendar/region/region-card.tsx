"use client";
import { useOptimistic, useTransition } from "react";
import { Check } from "lucide-react";
import { OrgBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { Switch } from "@/components/ui/toggle";
import { cn } from "@/lib/cn";
import { ORGS, type OrgId } from "@/lib/orgs";
import { US_STATES, stateName } from "@/lib/states";
import { setOrgRegion, setOrgState, setShowDates } from "@/app/actions/calendar";

type R = { id: string; state: string; label: string };

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-10 items-center gap-2 rounded-[14px] border px-4 py-2 text-left text-sm font-medium transition-colors",
        active ? "border-transparent bg-primary text-primary-fg" : "border-border-strong bg-card hover:border-fg/40",
      )}
    >
      {active ? <Check className="size-4 shrink-0" strokeWidth={2.5} aria-hidden /> : null}
      {children}
    </button>
  );
}

export function RegionCard(props: { org: OrgId; showDates: boolean; state: string | null; regionId: string | null; regions: R[]; chapterNote: string | null }) {
  const [s, setS] = useOptimistic({ show: props.showDates, state: props.state, region: props.regionId }, (cur, patch: Partial<{ show: boolean; state: string | null; region: string | null }>) => ({ ...cur, ...patch }));
  const [, start] = useTransition();
  const statesWithRegions = [...new Set(props.regions.map((r) => r.state))];
  const featured = statesWithRegions[0];
  const regionsHere = props.regions.filter((r) => r.state === s.state);
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <OrgBadge org={props.org} />
        <label className="inline-flex items-center gap-3 text-sm text-muted">
          Show dates
          <Switch
            checked={s.show}
            label={`Show ${ORGS[props.org].name} dates`}
            onToggle={() => start(async () => { setS({ show: !s.show }); await setShowDates(props.org, !s.show); })}
          />
        </label>
      </div>
      {!s.show ? (
        <p className="mt-4 text-sm text-muted">Off. Turn on to see {ORGS[props.org].name} dates.</p>
      ) : (
        <div className="mt-5 space-y-5 border-t border-border pt-5">
          {props.chapterNote ? <p className="rounded-[16px] bg-subtle px-4 py-3 text-sm">{props.chapterNote}</p> : null}
          <div>
            <p className="eyebrow mb-2.5">State</p>
            <div className="flex flex-wrap gap-2">
              {featured ? (
                <Pill active={s.state === featured} onClick={() => start(async () => { setS({ state: featured, region: null }); await setOrgState(props.org, featured); })}>
                  {stateName(featured)}
                </Pill>
              ) : null}
              <label className="sr-only" htmlFor={`state-${props.org}`}>
                Another state
              </label>
              <Select
                id={`state-${props.org}`}
                value={s.state && s.state !== featured ? s.state : ""}
                onChange={(e) => start(async () => { const v = e.target.value || null; setS({ state: v, region: null }); await setOrgState(props.org, v); })}
                className={cn("h-10 w-auto px-4 text-sm font-medium", s.state && s.state !== featured && "border-fg ring-4 ring-accent/30")}
              >
                <option value="">Another state</option>
                {US_STATES.filter(([c]) => c !== featured).map(([c, n]) => (
                  <option key={c} value={c}>
                    {n}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {s.state ? (
            <div>
              <p className="eyebrow mb-2.5">District / area</p>
              {regionsHere.length ? (
                <div className="flex flex-wrap gap-2">
                  {regionsHere.map((r) => (
                    <Pill key={r.id} active={s.region === r.id} onClick={() => start(async () => { setS({ region: r.id }); await setOrgRegion(props.org, r.id); })}>
                      {r.label}
                    </Pill>
                  ))}
                  <Pill active={!s.region} onClick={() => start(async () => { setS({ region: null }); await setOrgRegion(props.org, null); })}>
                    Not sure
                  </Pill>
                </div>
              ) : (
                <p className="text-sm text-muted">We don&apos;t have district or area data for {stateName(s.state)} yet. You&apos;ll still see state and international dates when they&apos;re published.</p>
              )}
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
