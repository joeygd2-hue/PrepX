import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { BackHeader, Page } from "@/components/ui/page";
import { DismissButton } from "./dismiss";

export const metadata: Metadata = { title: "Announcement" };

export default async function Announcement({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [a] = await db.select().from(schema.announcements).where(eq(schema.announcements.id, id));
  if (!a) notFound();
  return (
    <Page>
      <BackHeader href="/" title="Announcement" />
      <article className="rounded-3xl border border-border p-6">
        <p className="text-sm text-muted">{a.publishedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
        <h1 className="mt-2 text-2xl font-semibold">{a.title}</h1>
        <p className="mt-4 whitespace-pre-wrap">{a.body}</p>
        {a.sourceUrl ? (
          <a href={a.sourceUrl} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm underline">
            Source
          </a>
        ) : null}
      </article>
      <div className="mt-4">
        <DismissButton id={a.id} />
      </div>
    </Page>
  );
}
