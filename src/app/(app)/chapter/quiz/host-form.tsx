"use client";
import { useActionState, useState } from "react";
import { FieldError, Label, Select } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { createGameAction } from "@/app/actions/quiz";

export function HostForm({ chapters, clusters }: { chapters: { id: string; name: string; org: string }[]; clusters: { id: string; name: string; org: string; n: number }[] }) {
  const [state, action] = useActionState(createGameAction, undefined);
  const [chapterId, setChapterId] = useState(chapters[0].id);
  const org = chapters.find((c) => c.id === chapterId)?.org;
  const options = clusters.filter((c) => c.org === org);
  return (
    <form action={action} className="space-y-4 rounded-3xl border border-border p-5">
      <div>
        <Label htmlFor="chapterId">Chapter</Label>
        <Select id="chapterId" name="chapterId" value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
          {chapters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="clusterId">Question set</Label>
        <Select id="clusterId" name="clusterId" required disabled={!options.length}>
          {options.length ? (
            options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.n} questions)
              </option>
            ))
          ) : (
            <option>No question sets for this organization yet</option>
          )}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="count">Questions</Label>
          <Select id="count" name="count" defaultValue="10">
            {[5, 10, 15, 20].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="seconds">Seconds each</Label>
          <Select id="seconds" name="seconds" defaultValue="20">
            {[10, 20, 30, 45].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </Select>
        </div>
      </div>
      <FieldError>{state?.error}</FieldError>
      <SubmitButton disabled={!options.length}>Create game</SubmitButton>
    </form>
  );
}
