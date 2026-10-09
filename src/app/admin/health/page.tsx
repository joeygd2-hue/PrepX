import { desc } from "drizzle-orm";
import { db, schema } from "@/db";

export const metadata = { title: "Health" };

export default async function Health() {
  const errors = await db.select().from(schema.errorLog).orderBy(desc(schema.errorLog.createdAt)).limit(100);
  const emails = await db.select({ template: schema.emailLog.template, status: schema.emailLog.status, createdAt: schema.emailLog.createdAt }).from(schema.emailLog).orderBy(desc(schema.emailLog.createdAt)).limit(30);
  return (
    <div>
      <h1 className="text-3xl font-semibold">Service health</h1>
      <h2 className="eyebrow mt-8 mb-3">Recent errors (30-day retention)</h2>
      <ul className="divide-y divide-border rounded-3xl border border-border px-5 text-sm">
        {errors.map((e) => (
          <li key={e.id} className="py-2">
            <span className="text-muted">{e.createdAt.toLocaleString()}</span> · <span className="font-medium">{e.scope}</span> · {e.message}
          </li>
        ))}
        {!errors.length ? <li className="py-3 text-muted">No errors logged.</li> : null}
      </ul>
      <h2 className="eyebrow mt-8 mb-3">Email deliveries</h2>
      <ul className="divide-y divide-border rounded-3xl border border-border px-5 text-sm">
        {emails.map((e, i) => (
          <li key={i} className="py-2">
            <span className="text-muted">{e.createdAt.toLocaleString()}</span> · {e.template} · {e.status}
          </li>
        ))}
      </ul>
    </div>
  );
}
