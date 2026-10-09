import { desc, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { ActionButton } from "@/components/ui/action-form";
import { setChapterFlags } from "@/app/actions/admin";

export const metadata = { title: "Chapters" };

export default async function Chapters() {
  const rows = await db
    .select({ c: schema.chapters, members: sql<number>`(select count(*)::int from chapter_members m where m.chapter_id = ${schema.chapters.id})` })
    .from(schema.chapters)
    .orderBy(desc(schema.chapters.createdAt))
    .limit(200);
  const creatorIds = rows.map((r) => r.c.createdBy).filter((x): x is string => Boolean(x));
  const creators = creatorIds.length ? await db.select({ id: schema.users.id, email: schema.users.email }).from(schema.users).where(inArray(schema.users.id, creatorIds)) : [];
  return (
    <div>
      <h1 className="text-3xl font-semibold">Chapters</h1>
      <p className="mt-2 text-muted">Verify chapters after confirming with the school. &ldquo;Covers Pro&rdquo; gives every member Pro (for chapter licenses).</p>
      <ul className="mt-6 space-y-3">
        {rows.map(({ c, members }) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-3xl border border-border p-4">
            <span className="flex-1">
              <span className="font-medium">{c.name}</span>
              <span className="block text-sm text-muted">
                {c.org.toUpperCase()} · {c.school} · {members} members · created by {creators.find((x) => x.id === c.createdBy)?.email ?? "deleted user"}
              </span>
            </span>
            <ActionButton onClick={setChapterFlags.bind(null, c.id, { verified: !c.verifiedAt })}>{c.verifiedAt ? "Unverify" : "Verify"}</ActionButton>
            <ActionButton onClick={setChapterFlags.bind(null, c.id, { coversPro: !c.coversPro })}>{c.coversPro ? "Remove Pro coverage" : "Covers Pro"}</ActionButton>
          </li>
        ))}
        {!rows.length ? <li className="text-muted">No chapters yet.</li> : null}
      </ul>
    </div>
  );
}
