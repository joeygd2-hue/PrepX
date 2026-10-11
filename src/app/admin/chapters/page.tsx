import { desc, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { ActionButton } from "@/components/ui/action-form";
import { Chip } from "@/components/ui/badge";
import { Accent, PageTitle } from "@/components/ui/page";
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
    <div className="stagger">
      <PageTitle
        title={<Accent>Chapters</Accent>}
        subtitle={<>Verify chapters after confirming with the school. &ldquo;Covers Pro&rdquo; gives every member Pro (for chapter licenses).</>}
      />
      <ul className="divide-y divide-border rounded-[24px] border border-border bg-card px-4 shadow-card sm:px-5">
        {rows.map(({ c, members }) => (
          <li key={c.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-4">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-medium tracking-[-0.01em]">{c.name}</span>
                {c.verifiedAt ? <Chip>Verified</Chip> : null}
                {c.coversPro ? <Chip>Pro</Chip> : null}
              </p>
              <p className="mt-1 break-words text-sm text-muted">
                <span className="font-mono text-xs tracking-wider">{c.org.toUpperCase()}</span> · {c.school} · <span className="font-mono tabular">{members}</span> members · created by{" "}
                {creators.find((x) => x.id === c.createdBy)?.email ?? "deleted user"}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <ActionButton onClick={setChapterFlags.bind(null, c.id, { verified: !c.verifiedAt })}>{c.verifiedAt ? "Unverify" : "Verify"}</ActionButton>
              <ActionButton onClick={setChapterFlags.bind(null, c.id, { coversPro: !c.coversPro })}>{c.coversPro ? "Remove Pro coverage" : "Covers Pro"}</ActionButton>
            </div>
          </li>
        ))}
        {!rows.length ? <li className="py-4 text-muted">No chapters yet.</li> : null}
      </ul>
    </div>
  );
}
