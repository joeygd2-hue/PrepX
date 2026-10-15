import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireRole } from "@/server/auth/session";
import { ActionForm } from "@/components/ui/action-form";
import { Card, SectionLabel } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/form";
import { Accent, PageTitle } from "@/components/ui/page";
import { setUserRole } from "@/app/actions/admin";

export const metadata = { title: "Users" };

export default async function Users() {
  await requireRole(["admin"]);
  const audit = await db.select().from(schema.auditLog).orderBy(desc(schema.auditLog.createdAt)).limit(50);
  return (
    <div className="stagger max-w-3xl">
      <PageTitle
        title={
          <>
            Users &amp; <Accent>roles</Accent>
          </>
        }
        subtitle="Staff can manage content. Admins can also manage roles and plan limits. Student data is not browsable here by design."
      />
      <Card>
        <ActionForm
          action={setUserRole}
          submit="Set role"
          className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] [&>[role=alert]]:order-last [&>[role=alert]]:col-span-full [&>[role=status]]:order-last [&>[role=status]]:col-span-full"
        >
          <div className="min-w-0">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div>
            <Label htmlFor="role">Role</Label>
            <Select id="role" name="role" defaultValue="staff">
              <option value="student">Student</option>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </Select>
          </div>
        </ActionForm>
      </Card>
      <SectionLabel>Audit log</SectionLabel>
      <ul className="divide-y divide-border rounded-[24px] border border-border bg-card px-4 text-sm shadow-card sm:px-5">
        {audit.map((a) => (
          <li key={a.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3">
            <span className="font-mono text-xs text-muted tabular sm:w-[11.5rem] sm:shrink-0">{a.createdAt.toLocaleString()}</span>
            <span className="font-mono text-[13px] font-medium">{a.action}</span>
            {a.target ? <span className="min-w-0 break-all font-mono text-xs text-muted">{a.target}</span> : null}
          </li>
        ))}
        {!audit.length ? <li className="py-4 text-muted">Nothing logged yet.</li> : null}
      </ul>
    </div>
  );
}
