import type { Metadata } from "next";
import { requireUser } from "@/server/auth/session";
import { BackHeader, Page } from "@/components/ui/page";
import { FeedbackForm } from "../feedback/form";

export const metadata: Metadata = { title: "Ambassador program" };

export default async function Ambassador() {
  await requireUser();
  return (
    <Page>
      <BackHeader href="/profile" title="Ambassador program" />
      <h1 className="text-3xl font-semibold tracking-tight">Bring PrepX to other schools</h1>
      <p className="mt-3 text-muted">
        Ambassadors help their chapter and nearby schools get started: sharing join codes, running quiz nights and passing feedback to our team. Tell us about your chapter and why
        you&apos;d like to help. We&apos;ll reply by email.
      </p>
      <div className="mt-6">
        <FeedbackForm kinds={[["ambassador", "Ambassador application"]]} placeholder="Your school, your organization(s), and how you'd share PrepX" />
      </div>
    </Page>
  );
}
