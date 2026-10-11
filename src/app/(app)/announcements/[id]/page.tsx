import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowUpRight } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { BackHeader, Page } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
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
      <Card>
        <article>
          <p className="eyebrow">{a.publishedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
          <h1 className="mt-3 text-[1.75rem] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[2rem]">{a.title}</h1>
          <p className="mt-5 whitespace-pre-wrap text-[15px] leading-relaxed">{a.body}</p>
          {a.sourceUrl ? (
            <a
              href={a.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-border-strong px-3.5 py-1.5 text-sm font-medium transition-colors hover:bg-subtle"
            >
              Source <ArrowUpRight className="size-3.5" aria-hidden />
            </a>
          ) : null}
        </article>
      </Card>
      <div className="mt-4">
        <DismissButton id={a.id} />
      </div>
    </Page>
  );
}
