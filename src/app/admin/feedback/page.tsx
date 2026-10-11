import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { ActionButton } from "@/components/ui/action-form";
import { Accent, PageTitle } from "@/components/ui/page";
import { cn } from "@/lib/cn";
import { setFeedbackStatus } from "@/app/actions/admin";

export const metadata = { title: "Feedback" };

export default async function Feedback() {
  const rows = await db.select().from(schema.feedback).orderBy(desc(schema.feedback.createdAt)).limit(200);
  return (
    <div className="stagger">
      <PageTitle
        title={
          <>
            Feedback &amp; <Accent>reports</Accent>
          </>
        }
      />
      <ul className="divide-y divide-border rounded-[24px] border border-border bg-card px-4 shadow-card sm:px-5">
        {rows.map((f) => (
          <li key={f.id} className={cn("flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:gap-4", f.status === "resolved" && "opacity-60")}>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 font-mono text-xs text-muted tabular">
                {f.status === "open" ? <span className="size-1.5 rounded-full bg-accent shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--fg)_25%,transparent)]" aria-hidden /> : null}
                {f.kind} · {f.createdAt.toLocaleString()} · {f.status}
              </p>
              <p className="mt-1.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed">{f.body}</p>
            </div>
            <div className="shrink-0">
              <ActionButton onClick={setFeedbackStatus.bind(null, f.id, f.status === "open" ? "resolved" : "open")}>{f.status === "open" ? "Mark resolved" : "Reopen"}</ActionButton>
            </div>
          </li>
        ))}
        {!rows.length ? <li className="py-4 text-muted">Nothing yet.</li> : null}
      </ul>
    </div>
  );
}
