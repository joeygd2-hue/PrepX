import type { Metadata } from "next";
import { requireUser } from "@/server/auth/session";
import { BackHeader, Page } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { FeedbackForm } from "./form";

export const metadata: Metadata = { title: "Send feedback" };

export default async function Feedback() {
  await requireUser();
  return (
    <Page>
      <BackHeader href="/profile" title="Send feedback" />
      <p className="mb-5 max-w-lg px-1 text-muted">Found a bug, a wrong answer or an idea? Tell us. Please don&apos;t include personal information.</p>
      <Card>
        <FeedbackForm kinds={[["bug", "Report a bug"], ["idea", "Share an idea"], ["content_report", "Report incorrect or inappropriate content"]]} />
      </Card>
    </Page>
  );
}
