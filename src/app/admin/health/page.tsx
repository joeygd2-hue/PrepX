import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { SectionLabel } from "@/components/ui/card";
import { Accent, PageTitle } from "@/components/ui/page";
import { cn } from "@/lib/cn";

export const metadata = { title: "Health" };

export default async function Health() {
  const errors = await db.select().from(schema.errorLog).orderBy(desc(schema.errorLog.createdAt)).limit(100);
  const emails = await db.select({ template: schema.emailLog.template, status: schema.emailLog.status, createdAt: schema.emailLog.createdAt }).from(schema.emailLog).orderBy(desc(schema.emailLog.createdAt)).limit(30);
  return (
    <div className="stagger">
      <PageTitle
        title={
          <>
            Service <Accent>health</Accent>
          </>
        }
      />
      <SectionLabel className="mt-0">Recent errors (30-day retention)</SectionLabel>
      <ul className="divide-y divide-border rounded-[24px] border border-border bg-card px-4 text-sm shadow-card sm:px-5">
        {errors.map((e) => (
          <li key={e.id} className="grid gap-1 py-3 sm:grid-cols-[11.5rem_10rem_minmax(0,1fr)] sm:gap-4">
            <span className="font-mono text-xs text-muted tabular sm:pt-px">{e.createdAt.toLocaleString()}</span>
            <span className="break-words font-mono text-[13px] font-medium">{e.scope}</span>
            <span className="min-w-0 break-words">{e.message}</span>
          </li>
        ))}
        {!errors.length ? <li className="py-4 text-muted">No errors logged.</li> : null}
      </ul>
      <SectionLabel>Email deliveries</SectionLabel>
      <ul className="divide-y divide-border rounded-[24px] border border-border bg-card px-4 text-sm shadow-card sm:px-5">
        {emails.map((e, i) => (
          <li key={i} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3">
            <span className="font-mono text-xs text-muted tabular sm:w-[11.5rem] sm:shrink-0">{e.createdAt.toLocaleString()}</span>
            <span className="min-w-0 flex-1 break-words">{e.template}</span>
            <span className={cn("font-mono text-xs", e.status === "failed" ? "font-medium text-danger" : "text-muted")}>{e.status}</span>
          </li>
        ))}
        {!emails.length ? <li className="py-4 text-muted">No emails sent yet.</li> : null}
      </ul>
    </div>
  );
}
