import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ActionForm } from "@/components/ui/action-form";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import { BackHeader } from "@/components/ui/page";
import { saveEvent } from "@/app/actions/admin";

export const metadata = { title: "Edit event" };

export default async function EditEvent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [e] = await db.select().from(schema.events).where(eq(schema.events.id, id));
  if (!e) notFound();
  const vOpts = (
    <>
      <option value="verified">Verified against official guidelines</option>
      <option value="reference_observed">Observed in a published reference</option>
      <option value="unverified">Unverified</option>
    </>
  );
  return (
    <div className="stagger mx-auto max-w-3xl">
      <BackHeader href="/admin/events" />
      <header className="mb-7">
        <p className="eyebrow mb-2">
          {e.org.toUpperCase()} · {e.code} · {e.category}
        </p>
        <h1 className="text-[1.75rem] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[2rem]">{e.name}</h1>
      </header>
      <ActionForm action={saveEvent} className="space-y-3">
        <input type="hidden" name="id" value={e.id} />
        <Card className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={e.name} />
          </div>
          <div>
            <Label htmlFor="formatLabel">Format label</Label>
            <Input id="formatLabel" name="formatLabel" defaultValue={e.formatLabel} />
          </div>
          <label className="flex cursor-pointer items-center gap-3 rounded-[16px] border border-border bg-card p-4 text-sm font-medium transition-[border-color,box-shadow] duration-200 hover:border-border-strong has-[:checked]:border-fg has-[:checked]:ring-4 has-[:checked]:ring-accent/30">
            <input type="checkbox" name="active" defaultChecked={e.active} className="size-5 shrink-0 accent-[var(--fg)]" /> Active (shown to students)
          </label>
        </Card>
        <Card className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="verification">Format status</Label>
              <Select id="verification" name="verification" defaultValue={e.verification}>
                {vOpts}
              </Select>
            </div>
            <div>
              <Label htmlFor="rubricVerification">Rubric status</Label>
              <Select id="rubricVerification" name="rubricVerification" defaultValue={e.rubricVerification}>
                {vOpts}
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="sourceUrl">Official source</Label>
              <Input id="sourceUrl" name="sourceUrl" type="url" defaultValue={e.sourceUrl ?? ""} />
            </div>
            <div>
              <Label htmlFor="sourceCheckedAt">Checked on</Label>
              <Input id="sourceCheckedAt" name="sourceCheckedAt" type="date" defaultValue={e.sourceCheckedAt ?? ""} className="font-mono tabular" />
            </div>
          </div>
        </Card>
        <Card className="space-y-4">
          <div>
            <Label htmlFor="components">Components (JSON)</Label>
            <Textarea id="components" name="components" rows={8} className="bg-subtle/50 font-mono text-[13px]" spellCheck={false} defaultValue={JSON.stringify(e.components, null, 2)} />
          </div>
          <div>
            <Label htmlFor="rubric">Practice rubric criteria (JSON list of {"{id, label, description}"}). Never add official point values unless verified.</Label>
            <Textarea id="rubric" name="rubric" rows={8} className="bg-subtle/50 font-mono text-[13px]" spellCheck={false} defaultValue={JSON.stringify(e.rubric, null, 2)} />
          </div>
        </Card>
      </ActionForm>
    </div>
  );
}
