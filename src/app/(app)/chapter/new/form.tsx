"use client";
import { useActionState, useState } from "react";
import { FieldError, Input, Label, Select } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { ORGS, ORG_IDS } from "@/lib/orgs";
import { US_STATES } from "@/lib/states";
import { createChapterAction } from "@/app/actions/chapter";

export function NewChapterForm({ regions }: { regions: { id: string; org: string; state: string; label: string }[] }) {
  const [state, action] = useActionState(createChapterAction, undefined);
  const [org, setOrg] = useState("deca");
  const [st, setSt] = useState("");
  const options = regions.filter((r) => r.org === org && r.state === st);
  return (
    <form action={action} className="mt-6 space-y-5">
      <div>
        <Label htmlFor="org">Organization</Label>
        <Select id="org" name="org" value={org} onChange={(e) => setOrg(e.target.value)}>
          {ORG_IDS.map((o) => (
            <option key={o} value={o}>
              {ORGS[o].fullName}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="name">Chapter name</Label>
        <Input id="name" name="name" required maxLength={80} placeholder="e.g. Lakeside High DECA" />
      </div>
      <div>
        <Label htmlFor="school">School</Label>
        <Input id="school" name="school" required maxLength={120} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="state">State</Label>
          <Select id="state" name="state" value={st} onChange={(e) => setSt(e.target.value)}>
            <option value="">Select</option>
            {US_STATES.map(([c, n]) => (
              <option key={c} value={c}>
                {n}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="regionId">District / area</Label>
          <Select id="regionId" name="regionId" defaultValue="" disabled={!options.length}>
            <option value="">{options.length ? "Not sure" : "Not available"}</option>
            {options.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <label className="flex items-start gap-3 rounded-2xl border border-border p-4 text-sm">
        <input type="checkbox" name="confirm" className="mt-0.5 size-5 accent-[var(--fg)]" required />
        <span>I&apos;m this chapter&apos;s advisor, or a chapter officer setting it up with my advisor&apos;s permission.</span>
      </label>
      <FieldError>{state?.error}</FieldError>
      <SubmitButton block size="lg" pendingText="Creating…">
        Create chapter
      </SubmitButton>
    </form>
  );
}
