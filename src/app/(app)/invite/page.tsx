import type { Metadata } from "next";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { env } from "@/lib/env";
import { BackHeader, Page } from "@/components/ui/page";
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
      <h1 className="text-3xl font-semibold tracking-tight">Study together</h1>
      <p className="mt-2 text-muted">Earn 100 XP and the Recruiter badge when a friend you invite starts practicing. Only share with people you know.</p>
      <ShareLink link={link} />
      <div className="mt-6 grid grid-cols-2 gap-3 text-center">
        <div className="rounded-3xl bg-subtle p-5">
          <p className="text-3xl font-semibold tabular">{joined}</p>
          <p className="text-sm text-muted">joined</p>
        </div>
        <div className="rounded-3xl bg-subtle p-5">
          <p className="text-3xl font-semibold tabular">{active}</p>
          <p className="text-sm text-muted">started practicing</p>
        </div>
      </div>
    </Page>
  );
}
