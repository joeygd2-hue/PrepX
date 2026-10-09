import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { ActionButton } from "@/components/ui/action-form";
import { setFeedbackStatus } from "@/app/actions/admin";

export const metadata = { title: "Feedback" };

export default async function Feedback() {
  const rows = await db.select().from(schema.feedback).orderBy(desc(schema.feedback.createdAt)).limit(200);
  return (
    <div>
      <h1 className="text-3xl font-semibold">Feedback & reports</h1>
      <ul className="mt-6 space-y-3">
        {rows.map((f) => (
          <li key={f.id} className={`rounded-3xl border border-border p-4 ${f.status === "resolved" ? "opacity-60" : ""}`}>
            <p className="text-xs text-muted">
              {f.kind} · {f.createdAt.toLocaleString()} · {f.status}
            </p>
            <p className="mt-1 whitespace-pre-wrap">{f.body}</p>
            <div className="mt-2">
              <ActionButton onClick={setFeedbackStatus.bind(null, f.id, f.status === "open" ? "resolved" : "open")}>{f.status === "open" ? "Mark resolved" : "Reopen"}</ActionButton>
            </div>
          </li>
        ))}
        {!rows.length ? <li className="text-muted">Nothing yet.</li> : null}
      </ul>
    </div>
  );
}
