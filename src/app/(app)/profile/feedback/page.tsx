import type { Metadata } from "next";
import { requireUser } from "@/server/auth/session";
import { BackHeader, Page } from "@/components/ui/page";
import { FeedbackForm } from "./form";

export const metadata: Metadata = { title: "Send feedback" };

export default async function Feedback() {
  await requireUser();
  return (
    <Page>
      <BackHeader href="/profile" title="Send feedback" />
      <p className="mb-5 text-muted">Found a bug, a wrong answer or an idea? Tell us. Please don&apos;t include personal information.</p>
      <FeedbackForm kinds={[["bug", "Report a bug"], ["idea", "Share an idea"], ["content_report", "Report incorrect or inappropriate content"]]} />
    </Page>
  );
}
