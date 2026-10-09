import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { ActionForm, ActionButton } from "@/components/ui/action-form";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import { deleteAnnouncement, saveAnnouncement } from "@/app/actions/admin";

export const metadata = { title: "Announcements" };

export default async function Announcements() {
  const rows = await db.select().from(schema.announcements).orderBy(desc(schema.announcements.publishedAt)).limit(50);
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
      <section>
        <h1 className="text-3xl font-semibold">Announcements</h1>
        <p className="mt-2 text-muted">Shown on Home for students in that organization (or everyone).</p>
        <ActionForm action={saveAnnouncement} submit="Publish" className="mt-6 space-y-4">
          <div>
            <Label htmlFor="org">Audience</Label>
            <Select id="org" name="org" defaultValue="">
              <option value="">Everyone</option>
              {["deca", "fbla", "hosa", "tsa"].map((o) => (
                <option key={o} value={o}>
                  {o.toUpperCase()} students
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required />
          </div>
          <div>
            <Label htmlFor="body">Body</Label>
            <Textarea id="body" name="body" rows={5} required />
          </div>
          <div>
            <Label htmlFor="sourceUrl">Source URL (optional)</Label>
            <Input id="sourceUrl" name="sourceUrl" type="url" />
          </div>
          <div>
            <Label htmlFor="expiresAt">Expires (optional)</Label>
            <Input id="expiresAt" name="expiresAt" type="date" />
          </div>
        </ActionForm>
      </section>
      <section>
        <h2 className="eyebrow mb-3">Published</h2>
        <ul className="space-y-3">
          {rows.map((a) => (
            <li key={a.id} className="rounded-3xl border border-border p-4">
              <p className="text-xs text-muted">
                {a.org?.toUpperCase() ?? "Everyone"} · {a.publishedAt.toLocaleDateString()}
                {a.expiresAt ? ` · expires ${a.expiresAt.toLocaleDateString()}` : ""}
              </p>
              <p className="font-medium">{a.title}</p>
              <p className="mt-1 text-sm text-muted line-clamp-3">{a.body}</p>
              <div className="mt-2">
                <ActionButton variant="danger" onClick={deleteAnnouncement.bind(null, a.id)}>
                  Delete
                </ActionButton>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
