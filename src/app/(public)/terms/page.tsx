import type { Metadata } from "next";
import { env } from "@/lib/env";
import { PublicPage, Prose } from "@/components/shell/public-page";

export const metadata: Metadata = { title: "Terms of Service" };

export default function Terms() {
  return (
    <PublicPage>
      <h1 className="text-4xl font-bold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-muted">Effective October 9, 2026 · Draft pending legal review</p>
      <Prose>
        <h2>Using PrepX</h2>
        <p>You must be 13 or older. If you&apos;re under 18, you confirm a parent or guardian has agreed to these terms, especially before making purchases.</p>
        <h2>Not official</h2>
        <p>PrepX is an independent study tool and is not affiliated with or endorsed by DECA, FBLA, HOSA, TSA or any other organization. Practice questions are original PrepX content or AI-generated, and AI scores are simulated practice feedback, not official scores or predictions. Always follow the official guidelines for your event.</p>
        <h2>Your content</h2>
        <p>You own what you write. You give us permission to process it to provide the service (for example, sending a transcript to our AI provider for feedback). Don&apos;t submit others&apos; personal information or content you don&apos;t have rights to.</p>
        <h2>Academic integrity</h2>
        <p>Use PrepX to learn and practice. Follow your organization&apos;s rules about outside help on written entries and projects. Don&apos;t submit AI-written work as your own where that isn&apos;t allowed.</p>
        <h2>Acceptable use</h2>
        <p>No harassment, cheating on leaderboards, sharing join codes publicly, scraping, or trying to access other people&apos;s accounts. We may suspend accounts that break these rules.</p>
        <h2>Plans and payments</h2>
        <p>Free plan allowances are shown in the app. Pro subscriptions renew monthly until cancelled; cancel anytime in Your plan and you keep Pro until the end of the paid period. Season boosts are one-time purchases that end July 31 and don&apos;t renew. We never move you to a paid plan without your purchase. If an AI request fails, it doesn&apos;t count against your allowance.</p>
        <h2>Changes and availability</h2>
        <p>We may update features and these terms; we&apos;ll notify you of material changes. The service is provided as is, without warranties, to the extent permitted by law.</p>
        <h2>Contact</h2>
        <p><a href={`mailto:${env.supportEmail}`}>{env.supportEmail}</a></p>
      </Prose>
    </PublicPage>
  );
}
