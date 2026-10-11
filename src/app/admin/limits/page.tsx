import { db, schema } from "@/db";
import { requireRole } from "@/server/auth/session";
import { getLaunchAccess } from "@/server/settings";
import { ActionForm } from "@/components/ui/action-form";
import { Card, SectionLabel } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { Accent, PageTitle } from "@/components/ui/page";
import { saveLimit } from "@/app/actions/admin";
import { LaunchAccessCard } from "./launch-access";

export const metadata = { title: "Plan limits" };

export default async function Limits() {
  await requireRole(["admin"]);
  const [rows, launch] = await Promise.all([db.select().from(schema.planLimits), getLaunchAccess()]);
  return (
    <div className="stagger">
      <PageTitle
        title={
          <>
            Plan <Accent>limits</Accent>
          </>
        }
        subtitle="-1 means unlimited. Changes apply immediately and are enforced on the server."
      />
      <LaunchAccessCard active={launch.active} endsOn={launch.endsOn} />
      <SectionLabel>Limits</SectionLabel>
      <Card className="divide-y divide-border p-0 sm:p-0">
        {rows.map((l) => (
          <ActionForm
            key={l.feature}
            action={saveLimit}
            className="grid grid-cols-3 items-end gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_9rem_auto] sm:px-6 [&>button]:col-span-3 sm:[&>button]:col-span-1 [&>[role=alert]]:order-last [&>[role=alert]]:col-span-full [&>[role=status]]:order-last [&>[role=status]]:col-span-full"
          >
            <input type="hidden" name="feature" value={l.feature} />
            <div className="col-span-3 min-w-0 self-center sm:col-span-1">
              <p className="font-medium tracking-[-0.01em]">{l.label}</p>
              <p className="mt-0.5 break-all font-mono text-xs text-muted">{l.feature}</p>
            </div>
            <label className="block min-w-0">
              <span className="eyebrow mb-1.5 block">Free</span>
              <Input name="freeLimit" type="number" defaultValue={l.freeLimit} className="px-3 font-mono tabular" />
            </label>
            <label className="block min-w-0">
              <span className="eyebrow mb-1.5 block">Pro</span>
              <Input name="proLimit" type="number" defaultValue={l.proLimit} className="px-3 font-mono tabular" />
            </label>
            <label className="block min-w-0">
              <span className="eyebrow mb-1.5 block">Period</span>
              <Select name="period" defaultValue={l.period} className="px-3">
                {["day", "month", "season", "lifetime"].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </Select>
            </label>
          </ActionForm>
        ))}
      </Card>
    </div>
  );
}
