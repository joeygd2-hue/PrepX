import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireRole } from "@/server/auth/session";
import { ActionForm } from "@/components/ui/action-form";
import { Input, Label, Select } from "@/components/ui/form";
import { setUserRole } from "@/app/actions/admin";

export const metadata = { title: "Users" };

export default async function Users() {
  await requireRole(["admin"]);
  const audit = await db.select().from(schema.auditLog).orderBy(desc(schema.auditLog.createdAt)).limit(50);
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold">Users & roles</h1>
      <p className="mt-2 text-muted">Staff can manage content. Admins can also manage roles and plan limits. Student data is not browsable here by design.</p>
      <ActionForm action={setUserRole} submit="Set role" className="mt-6 grid items-end gap-3 rounded-3xl border border-border p-4 sm:grid-cols-[1fr_160px_auto]">
        <div>
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
      <h2 className="eyebrow mt-10 mb-3">Audit log</h2>
      <ul className="divide-y divide-border rounded-3xl border border-border px-5 text-sm">
        {audit.map((a) => (
          <li key={a.id} className="py-2">
            <span className="text-muted">{a.createdAt.toLocaleString()}</span> · <span className="font-medium">{a.action}</span> {a.target ? `· ${a.target}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
