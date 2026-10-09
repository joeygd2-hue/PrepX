import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ActionForm } from "@/components/ui/action-form";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
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
    <div className="max-w-3xl">
      <p className="text-sm text-muted">{e.org.toUpperCase()} · {e.code} · {e.category}</p>
      <h1 className="text-3xl font-semibold">{e.name}</h1>
      <ActionForm action={saveEvent} className="mt-6 space-y-4">
        <input type="hidden" name="id" value={e.id} />
        <div><Label htmlFor="name">Name</Label><Input id="name" name="name" defaultValue={e.name} /></div>
        <div><Label htmlFor="formatLabel">Format label</Label><Input id="formatLabel" name="formatLabel" defaultValue={e.formatLabel} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="verification">Format status</Label><Select id="verification" name="verification" defaultValue={e.verification}>{vOpts}</Select></div>
          <div><Label htmlFor="rubricVerification">Rubric status</Label><Select id="rubricVerification" name="rubricVerification" defaultValue={e.rubricVerification}>{vOpts}</Select></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="sourceUrl">Official source</Label><Input id="sourceUrl" name="sourceUrl" type="url" defaultValue={e.sourceUrl ?? ""} /></div>
          <div><Label htmlFor="sourceCheckedAt">Checked on</Label><Input id="sourceCheckedAt" name="sourceCheckedAt" type="date" defaultValue={e.sourceCheckedAt ?? ""} /></div>
        </div>
        <div>
          <Label htmlFor="components">Components (JSON)</Label>
          <Textarea id="components" name="components" rows={8} className="font-mono text-xs" defaultValue={JSON.stringify(e.components, null, 2)} />
        </div>
        <div>
          <Label htmlFor="rubric">Practice rubric criteria (JSON list of {"{id, label, description}"}). Never add official point values unless verified.</Label>
          <Textarea id="rubric" name="rubric" rows={8} className="font-mono text-xs" defaultValue={JSON.stringify(e.rubric, null, 2)} />
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={e.active} className="size-4" /> Active (shown to students)</label>
      </ActionForm>
    </div>
  );
}
