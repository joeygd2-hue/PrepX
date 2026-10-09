import type { Metadata } from "next";
import { requireUser } from "@/server/auth/session";
import { BackHeader, Page } from "@/components/ui/page";
import { ShareCards } from "./cards";

export const metadata: Metadata = { title: "Share your wins" };

export default async function Share() {
  await requireUser();
  return (
    <Page>
      <BackHeader href="/" title="Share your wins" />
      <p className="text-muted">Story-sized cards for your streak, level and personal bests. Cards show your first name only if you turn it on, and never your school or email.</p>
      <ShareCards />
    </Page>
  );
}
