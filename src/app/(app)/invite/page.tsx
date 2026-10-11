import type { Metadata } from "next";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { env } from "@/lib/env";
import { UserPlus, Zap } from "lucide-react";
import { Accent, BackHeader, Page } from "@/components/ui/page";
import { Card, HeroTexture } from "@/components/ui/card";
import { StatStrip } from "@/components/ui/tile";
import { ShareLink } from "./share-link";

export const metadata: Metadata = { title: "Invite friends" };

export default async function Invite() {
  const user = await requireUser();
  const link = `${env.appUrl}/sign-in?ref=${user.profile!.referralCode}`;
  const [{ joined, active }] = await db
    .select({
      joined: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where exists (select 1 from activity_days a where a.user_id = ${schema.profiles.userId}))::int`,
    })
    .from(schema.profiles)
    .where(eq(schema.profiles.referredBy, user.id));
  return (
    <Page>
      <BackHeader href="/" title="Invite friends" />
      <Card tone="inverse" className="p-6 shadow-float sm:p-8">
        <HeroTexture />
        <div className="relative">
          <h1 className="text-[2rem] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[2.5rem]">
            Study <Accent>together</Accent>
          </h1>
          <p className="mt-3 max-w-md text-hero-muted">Earn 100 XP and the Recruiter badge when a friend you invite starts practicing. Only share with people you know.</p>
          <ShareLink link={link} />
        </div>
      </Card>
      <StatStrip
        className="mt-3"
        items={[
          { icon: <UserPlus />, value: String(joined), label: "joined" },
          { icon: <Zap />, value: String(active), label: "started practicing" },
        ]}
      />
    </Page>
  );
}
