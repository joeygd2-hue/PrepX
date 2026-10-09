import { db, schema } from "@/db";
import { requireRole } from "@/server/auth/session";
import { ActionForm } from "@/components/ui/action-form";
import { Input, Select } from "@/components/ui/form";
import { saveLimit } from "@/app/actions/admin";

export const metadata = { title: "Plan limits" };

export default async function Limits() {
  await requireRole(["admin"]);
  const rows = await db.select().from(schema.planLimits);
  return (
    <div>
      <h1 className="text-3xl font-semibold">Plan limits</h1>
      <p className="mt-2 text-muted">-1 means unlimited. Changes apply immediately and are enforced on the server.</p>
      <div className="mt-6 space-y-3">
        {rows.map((l) => (
          <ActionForm key={l.feature} action={saveLimit} className="grid items-end gap-3 rounded-3xl border border-border p-4 sm:grid-cols-[1fr_120px_120px_140px_auto]">
            <input type="hidden" name="feature" value={l.feature} />
            <div><p className="font-medium">{l.label}</p><p className="text-xs text-muted">{l.feature}</p></div>
            <label className="text-xs">Free<Input name="freeLimit" type="number" defaultValue={l.freeLimit} /></label>
            <label className="text-xs">Pro<Input name="proLimit" type="number" defaultValue={l.proLimit} /></label>
            <label className="text-xs">Period<Select name="period" defaultValue={l.period}>{["day", "month", "season", "lifetime"].map((p) => <option key={p}>{p}</option>)}</Select></label>
          </ActionForm>
        ))}
      </div>
    </div>
  );
}
