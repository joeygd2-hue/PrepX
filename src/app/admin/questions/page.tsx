import { asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ActionButton, ActionForm } from "@/components/ui/action-form";
import { Select } from "@/components/ui/form";
import { aiGenerateQuestions, setQuestionStatus } from "@/app/actions/admin";

export const metadata = { title: "Questions" };
const L = ["A", "B", "C", "D"];

export default async function Questions() {
  const units = await db
    .select({ id: schema.units.id, title: schema.units.title, cluster: schema.examClusters.name })
    .from(schema.units)
    .innerJoin(schema.examClusters, eq(schema.examClusters.id, schema.units.clusterId))
    .orderBy(asc(schema.units.clusterId), asc(schema.units.position));
  const review = await db.select().from(schema.questions).where(eq(schema.questions.status, "review")).orderBy(desc(schema.questions.createdAt)).limit(50);
  return (
    <div>
      <h1 className="text-3xl font-semibold">Question bank</h1>
      <p className="mt-2 text-muted">AI-generated questions go to review first and are labeled &ldquo;AI-generated practice question&rdquo; to students. Never paste questions from official or copyrighted exams.</p>
      <ActionForm action={aiGenerateQuestions} submit="Generate for review" className="mt-6 grid items-end gap-3 rounded-3xl border border-border p-4 sm:grid-cols-[1fr_120px_auto]">
        <label className="text-sm">
          Unit
          <Select name="unitId">
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.cluster} · {u.title}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-sm">
          Count
          <Select name="count" defaultValue="5">
            {[3, 5, 10].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </Select>
        </label>
      </ActionForm>
      <h2 className="eyebrow mt-10 mb-3">Waiting for review ({review.length})</h2>
      <ul className="space-y-3">
        {review.map((q) => (
          <li key={q.id} className="rounded-3xl border border-border p-4">
            <p className="font-medium">{q.stem}</p>
            <ol className="mt-2 space-y-1 text-sm">
              {q.choices.map((c, i) => (
                <li key={i} className={i === q.answerIndex ? "font-semibold" : ""}>
                  {L[i]}. {c} {i === q.answerIndex ? "✓" : ""}
                </li>
              ))}
            </ol>
            <p className="mt-2 text-sm text-muted">{q.explanation}</p>
            <div className="mt-3 flex gap-2">
              <ActionButton variant="primary" onClick={setQuestionStatus.bind(null, q.id, "published")}>Publish</ActionButton>
              <ActionButton variant="danger" onClick={setQuestionStatus.bind(null, q.id, "retired")}>Reject</ActionButton>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
