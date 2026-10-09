import Link from "next/link";
import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { VerificationChip } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";

export const metadata = { title: "Competition dates" };

export default async function Competitions() {
  const rows = await db.select().from(schema.competitions).orderBy(asc(schema.competitions.startsOn));
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Competition dates</h1>
        <ButtonLink href="/admin/competitions/new" size="sm">
          Add date
        </ButtonLink>
      </div>
      <p className="mt-2 text-muted">Changing a date updates every countdown and study plan immediately. Record the official source and when you checked it.</p>
      <div className="mt-6 overflow-x-auto rounded-3xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-subtle text-left">
            <tr>
              {["Competition", "Level", "Dates", "Status", "Source checked", ""].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3">
                  <span className="font-medium">{c.name}</span>
                  <span className="block text-xs text-muted">{c.org.toUpperCase()} · {c.id}</span>
                </td>
                <td className="px-4 py-3">{c.level}</td>
                <td className="px-4 py-3 tabular">
                  {c.startsOn} → {c.endsOn}
                  {c.previousStartsOn ? <span className="block text-xs text-muted">was {c.previousStartsOn}</span> : null}
                </td>
                <td className="px-4 py-3">
                  <VerificationChip status={c.status} />
                </td>
                <td className="px-4 py-3">{c.sourceCheckedAt ?? "—"}</td>
                <td className="px-4 py-3">
                  <Link href={`/admin/competitions/${c.id}`} className="underline">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
