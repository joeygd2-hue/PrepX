import type { Metadata } from "next";
import { env } from "@/lib/env";
import { PublicPage, Prose } from "@/components/shell/public-page";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function Privacy() {
  return (
    <PublicPage>
      <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-muted">Effective October 9, 2026 · Draft pending legal review</p>
      <Prose>
        <p className="mt-6">PrepX helps high school students prepare for DECA, FBLA, HOSA and TSA competitive events. This policy explains what we collect, why, and the choices you have. It is written for students and parents.</p>
        <h2>Who can use PrepX</h2>
        <p>PrepX is for people 13 and older. During sign-up we ask for your date of birth only to confirm your age. If someone under 13 tries to sign up, we don&apos;t create the account and we don&apos;t keep what they entered. If you believe a child under 13 has an account, email {env.privacyEmail} and we will delete it.</p>
        <h2>What we collect</h2>
        <ul>
          <li><strong>Account:</strong> email address; first and last name; display name; date of birth; grade; optional school and state; time zone.</li>
          <li><strong>Study activity:</strong> events you choose, practice answers and scores, lessons, flashcard reviews, plans, XP, streaks and badges.</li>
          <li><strong>AI practice:</strong> messages to the AI coach, the text of judge-round transcripts, written entries or outlines you submit, and the feedback generated.</li>
          <li><strong>Chapter:</strong> chapters you join, your role, check-ins and points.</li>
          <li><strong>Technical:</strong> a session cookie to keep you signed in and limited logs (IP-based rate limiting, error messages). We don&apos;t use advertising trackers.</li>
          <li><strong>Payments:</strong> handled by Stripe. We store your subscription status, not card numbers.</li>
        </ul>
        <h2>Voice, camera and AI</h2>
        <ul>
          <li>Voice input uses your browser&apos;s speech recognition. In some browsers (such as Chrome) the browser maker processes the audio. PrepX never receives or stores audio, only the text you choose to submit.</li>
          <li>The camera preview in face-to-face practice stays on your device. Only if you tick the box do we send up to 3 still images to our AI provider for one feedback request; we don&apos;t store them.</li>
          <li>AI features send the needed text (and nothing that identifies you, like your name or email) to our AI provider, Anthropic, to generate feedback. Our provider does not use this data to train models under our commercial terms.</li>
          <li>AI scores are simulated practice feedback, not official results.</li>
        </ul>
        <h2>Who can see what</h2>
        <ul>
          <li>Your email, birthday and school are never shown to other users.</li>
          <li>Chapter members see your display name and role. Advisors and board members see your name, chapter points and, only if you allow it, your weekly question count.</li>
          <li>Leaderboards are off by default. If you opt in, you choose a nickname or your display name.</li>
          <li>Public trophy pages show badges and level. Your name is hidden unless you turn it on.</li>
          <li>Study buddies see your display name and streak.</li>
          <li>Family sharing: a parent or guardian you invite must confirm. They get a monthly summary (days practiced, streak, test accuracy, judge scores), never your messages, AI conversations or written responses. You can remove them anytime.</li>
        </ul>
        <h2>How long we keep data</h2>
        <ul>
          <li>Account and study data: until you delete your account.</li>
          <li>AI coach conversations and judge transcripts: 180 days, then deleted automatically. You can delete them sooner.</li>
          <li>Sign-in codes: 10 minutes. Sessions: 30 days.</li>
          <li>Rate-limit and error logs: up to 30 days.</li>
          <li>After deletion we keep only payment-provider event IDs and an anonymous record that a deletion happened.</li>
        </ul>
        <h2>Your choices</h2>
        <ul>
          <li>Download your data or delete your account from Profile at any time.</li>
          <li>Turn notifications and emails on or off individually. Account and security emails (like sign-in codes) are always sent.</li>
          <li>Parents can contact {env.privacyEmail} about their teen&apos;s account.</li>
        </ul>
        <h2>We never</h2>
        <ul>
          <li>Sell personal information or show third-party ads.</li>
          <li>Share data with competition organizations. PrepX is not affiliated with DECA, FBLA, HOSA or TSA.</li>
        </ul>
        <h2>Contact</h2>
        <p>Questions: <a href={`mailto:${env.privacyEmail}`}>{env.privacyEmail}</a>.</p>
      </Prose>
    </PublicPage>
  );
}
