import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { BackHeader, Page } from "@/components/ui/page";
import { NewChapterForm } from "./form";

export const metadata: Metadata = { title: "Start a chapter" };

export default async function NewChapter() {
  await requireUser();
  const regions = await db.select().from(schema.regions).orderBy(asc(schema.regions.position));
  return (
    <Page>
      <BackHeader href="/chapter" title="Start a chapter" />
      <p className="text-muted">
        Set up your school&apos;s chapter and share the join code with members. You&apos;ll be the chapter advisor and can add board members to help. PrepX staff may contact
        your school to verify chapters.
      </p>
      <NewChapterForm regions={regions.map((r) => ({ id: r.id, org: r.org, state: r.state, label: r.description ? `${r.name} · ${r.description}` : r.name }))} />
    </Page>
  );
}
