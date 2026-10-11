import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { ActionForm, ActionButton } from "@/components/ui/action-form";
import { Card, SectionLabel } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import { Accent, PageTitle } from "@/components/ui/page";
import { deleteAnnouncement, saveAnnouncement } from "@/app/actions/admin";

export const metadata = { title: "Announcements" };

export default async function Announcements() {
  const rows = await db.select().from(schema.announcements).orderBy(desc(schema.announcements.publishedAt)).limit(50);
  return (
    <div className="stagger">
      <PageTitle title={<Accent>Announcements</Accent>} subtitle="Shown on Home for students in that organization (or everyone)." />
      <div className="grid items-start gap-x-6 gap-y-10 lg:grid-cols-2">
        <section>
          <SectionLabel className="mt-0">New announcement</SectionLabel>
          <Card>
            <ActionForm action={saveAnnouncement} submit="Publish" className="space-y-4">
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
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="sourceUrl">Source URL (optional)</Label>
                  <Input id="sourceUrl" name="sourceUrl" type="url" />
                </div>
                <div>
                  <Label htmlFor="expiresAt">Expires (optional)</Label>
                  <Input id="expiresAt" name="expiresAt" type="date" className="font-mono tabular" />
                </div>
              </div>
            </ActionForm>
          </Card>
        </section>
        <section>
          <SectionLabel className="mt-0">Published</SectionLabel>
          <ul className="divide-y divide-border rounded-[24px] border border-border bg-card px-4 shadow-card sm:px-5">
            {rows.map((a) => (
              <li key={a.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs text-muted tabular">
                    {a.org?.toUpperCase() ?? "Everyone"} · {a.publishedAt.toLocaleDateString()}
                    {a.expiresAt ? ` · expires ${a.expiresAt.toLocaleDateString()}` : ""}
                  </p>
                  <p className="mt-1.5 font-medium tracking-[-0.01em]">{a.title}</p>
                  <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-muted">{a.body}</p>
                </div>
                <div className="shrink-0">
                  <ActionButton variant="danger" onClick={deleteAnnouncement.bind(null, a.id)}>
                    Delete
                  </ActionButton>
                </div>
              </li>
            ))}
            {!rows.length ? <li className="py-4 text-muted">Nothing published yet.</li> : null}
          </ul>
        </section>
      </div>
    </div>
  );
}
