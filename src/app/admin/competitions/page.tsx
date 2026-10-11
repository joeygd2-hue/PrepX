import Link from "next/link";
import { asc } from "drizzle-orm";
import { ChevronRight, Plus } from "lucide-react";
import { db, schema } from "@/db";
import { VerificationChip } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Accent, PageTitle } from "@/components/ui/page";

export const metadata = { title: "Competition dates" };

export default async function Competitions() {
  const rows = await db.select().from(schema.competitions).orderBy(asc(schema.competitions.startsOn));
  return (
    <div className="stagger">
      <PageTitle
        title={
          <>
            Competition <Accent>dates</Accent>
          </>
        }
        subtitle="Changing a date updates every countdown and study plan immediately. Record the official source and when you checked it."
      />
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-mono text-xs text-muted tabular">
          {rows.length} {rows.length === 1 ? "date" : "dates"}
        </p>
        <ButtonLink href="/admin/competitions/new" size="sm">
          <Plus className="size-4" aria-hidden />
          Add date
        </ButtonLink>
      </div>
      <Card className="overflow-hidden p-0 sm:p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="border-b border-border text-left">
              <tr>
                {["Competition", "Level", "Dates", "Status", "Source checked", ""].map((h) => (
                  <th key={h} className="eyebrow px-4 py-3.5 font-medium first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="py-3.5 pl-5 pr-4 sm:pl-6">
                    <span className="font-medium tracking-[-0.01em]">{c.name}</span>
                    <span className="mt-0.5 block font-mono text-xs text-muted">
                      {c.org.toUpperCase()} · {c.id}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 capitalize">{c.level}</td>
                  <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[13px] tabular">
                    {c.startsOn} → {c.endsOn}
                    {c.previousStartsOn ? <span className="mt-0.5 block text-xs text-muted">was {c.previousStartsOn}</span> : null}
                  </td>
                  <td className="px-4 py-3.5">
                    <VerificationChip status={c.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[13px] text-muted tabular">{c.sourceCheckedAt ?? "—"}</td>
                  <td className="py-3.5 pl-4 pr-5 text-right sm:pr-6">
                    <Link
                      href={`/admin/competitions/${c.id}`}
                      className="group/edit inline-flex h-10 items-center gap-1 rounded-[12px] px-3 font-medium transition-colors hover:bg-subtle"
                    >
                      Edit
                      <ChevronRight className="size-4 text-muted transition-transform group-hover/edit:translate-x-0.5" aria-hidden />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
