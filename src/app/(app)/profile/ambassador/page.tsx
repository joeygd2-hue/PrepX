import type { Metadata } from "next";
import { requireUser } from "@/server/auth/session";
import { Accent, BackHeader, Page } from "@/components/ui/page";
import { Card, HeroTexture } from "@/components/ui/card";
import { FeedbackForm } from "../feedback/form";

export const metadata: Metadata = { title: "Ambassador program" };

export default async function Ambassador() {
  await requireUser();
  return (
    <Page>
      <BackHeader href="/profile" title="Ambassador program" />
      <Card tone="inverse" className="p-6 shadow-float sm:p-8">
        <HeroTexture />
        <div className="relative">
          <h1 className="text-[2rem] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[2.5rem]">
            Bring PrepX to <Accent>other schools</Accent>
          </h1>
          <p className="mt-4 max-w-lg leading-relaxed text-hero-muted">
            Ambassadors help their chapter and nearby schools get started: sharing join codes, running quiz nights and passing feedback to our team. Tell us about your chapter and why
            you&apos;d like to help. We&apos;ll reply by email.
          </p>
        </div>
      </Card>
      <Card className="mt-3">
        <FeedbackForm kinds={[["ambassador", "Ambassador application"]]} placeholder="Your school, your organization(s), and how you'd share PrepX" />
      </Card>
    </Page>
  );
}
