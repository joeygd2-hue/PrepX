import type { Metadata } from "next";
import { eq, asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { ORGS, ORG_IDS } from "@/lib/orgs";
import { Accent, BackHeader, Page, PageTitle } from "@/components/ui/page";
import { SectionLabel } from "@/components/ui/card";
import { RegionCard } from "./region-card";

export const metadata: Metadata = { title: "Your competitions" };

export default async function Region() {
  const user = await requireUser();
  const prefs = await db.select().from(schema.orgPreferences).where(eq(schema.orgPreferences.userId, user.id));
  const regions = await db.select().from(schema.regions).orderBy(asc(schema.regions.position));
  const chapters = await db
    .select({ org: schema.chapters.org, name: schema.chapters.name, regionId: schema.chapters.regionId })
    .from(schema.chapterMembers)
    .innerJoin(schema.chapters, eq(schema.chapters.id, schema.chapterMembers.chapterId))
    .where(eq(schema.chapterMembers.userId, user.id));
  return (
    <Page>
      <BackHeader href="/calendar" />
      <PageTitle
        title={
          <>
            Your <Accent>competitions</Accent>
          </>
        }
        subtitle="Choose which organizations' dates you see and where you compete. If you're in a chapter, it uses your chapter's district or area."
      />
      {ORG_IDS.map((o) => {
        const p = prefs.find((x) => x.org === o);
        const ch = chapters.find((c) => c.org === o && c.regionId);
        return (
          <section key={o} aria-labelledby={`org-${o}`}>
            <SectionLabel id={`org-${o}`} className="mt-8">
              {ORGS[o].sectionLabel}
            </SectionLabel>
            <RegionCard
              org={o}
              showDates={p?.showDates ?? false}
              state={p?.state ?? null}
              regionId={p?.regionId ?? null}
              regions={regions.filter((r) => r.org === o).map((r) => ({ id: r.id, state: r.state, label: r.description ? `${r.name} · ${r.description}` : r.name }))}
              chapterNote={ch ? `Using ${ch.name}'s district: ${regions.find((r) => r.id === ch.regionId)?.name ?? "set by your chapter"}` : null}
            />
          </section>
        );
      })}
    </Page>
  );
}
