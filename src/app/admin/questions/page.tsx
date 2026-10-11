import { asc, desc, eq } from "drizzle-orm";
import { Check } from "lucide-react";
import { db, schema } from "@/db";
import { ActionButton, ActionForm } from "@/components/ui/action-form";
import { Card, SectionLabel } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { Accent, PageTitle } from "@/components/ui/page";
import { cn } from "@/lib/cn";
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
    <div className="stagger">
      <PageTitle
        title={
          <>
            Question <Accent>bank</Accent>
          </>
        }
        subtitle={<>AI-generated questions go to review first and are labeled &ldquo;AI-generated practice question&rdquo; to students. Never paste questions from official or copyrighted exams.</>}
      />
      <Card>
        <ActionForm
          action={aiGenerateQuestions}
          submit="Generate for review"
          className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_7.5rem_auto] [&>[role=alert]]:order-last [&>[role=alert]]:col-span-full [&>[role=status]]:order-last [&>[role=status]]:col-span-full"
        >
          <label className="block min-w-0 text-sm font-medium">
            <span className="mb-2 block">Unit</span>
            <Select name="unitId">
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.cluster} · {u.title}
                </option>
              ))}
            </Select>
          </label>
          <label className="block text-sm font-medium">
            <span className="mb-2 block">Count</span>
            <Select name="count" defaultValue="5" className="font-mono tabular">
              {[3, 5, 10].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </Select>
          </label>
        </ActionForm>
      </Card>
      <SectionLabel>
        Waiting for review (<span className="tabular">{review.length}</span>)
      </SectionLabel>
      <ul className="stagger space-y-3">
        {review.map((q) => (
          <li key={q.id}>
            <Card>
              <p className="text-[15px] font-medium leading-relaxed tracking-[-0.01em]">{q.stem}</p>
              <ol className="mt-4 space-y-1.5 text-sm">
                {q.choices.map((c, i) => {
                  const correct = i === q.answerIndex;
                  return (
                    <li key={i} className={cn("flex items-start gap-3 rounded-[12px] border px-3 py-2.5", correct ? "border-transparent bg-subtle font-semibold" : "border-border")}>
                      <span className="mt-px w-4 shrink-0 font-mono text-xs text-muted">{L[i]}.</span>
                      <span className="min-w-0 flex-1">{c}</span>
                      {correct ? (
                        <span role="img" aria-label="Correct answer" className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg">
                          <Check className="size-3" strokeWidth={3} aria-hidden />
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
              <p className="mt-4 text-sm leading-relaxed text-muted">{q.explanation}</p>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                <ActionButton variant="primary" onClick={setQuestionStatus.bind(null, q.id, "published")}>
                  Publish
                </ActionButton>
                <ActionButton variant="danger" onClick={setQuestionStatus.bind(null, q.id, "retired")}>
                  Reject
                </ActionButton>
              </div>
            </Card>
          </li>
        ))}
        {!review.length ? (
          <li>
            <Card tone="subtle" className="text-muted">
              Nothing waiting for review.
            </Card>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
