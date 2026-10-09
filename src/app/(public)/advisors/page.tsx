import type { Metadata } from "next";
import { PublicPage, Prose } from "@/components/shell/public-page";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "For advisors" };

export default function Advisors() {
  return (
    <PublicPage>
      <h1 className="text-4xl font-bold tracking-tight">For advisors</h1>
      <p className="mt-3 text-lg text-muted">Run your chapter&apos;s season in one place: join codes, meeting check-ins, announcements, quiz night and student practice.</p>
      <Prose>
        <h2>How it works</h2>
        <ul>
          <li>Create your chapter and share its 6-character join code. You can set the code to expire, regenerate it, or turn joining off.</li>
          <li>Promote students to board members so they can post announcements and open meeting check-ins.</li>
          <li>Students earn chapter points for check-ins and quiz nights; a chapter leaderboard keeps it fun.</li>
          <li>See weekly practice activity for students who choose to share it. You never see their email, birthday or private AI conversations.</li>
        </ul>
        <h2>Student privacy</h2>
        <p>PrepX is for ages 13+. Students control what they share, leaderboards are opt-in, and data can be exported or deleted at any time.</p>
        <h2>Chapter Pro</h2>
        <p>Chapters can cover Pro for their members. Contact us to set this up.</p>
      </Prose>
      <ButtonLink href="/sign-in" className="mt-8">
        Get started
      </ButtonLink>
    </PublicPage>
  );
}
