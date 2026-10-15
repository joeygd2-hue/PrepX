import type { Metadata } from "next";
import { env } from "@/lib/env";
import { PublicPage, PublicTitle, Prose } from "@/components/shell/public-page";
import { Accent } from "@/components/ui/page";

export const metadata: Metadata = { title: "Accessibility" };

export default function Accessibility() {
  return (
    <PublicPage>
      <PublicTitle title={<Accent>Accessibility</Accent>} lead="We want every student to be able to prepare with PrepX. We aim to meet WCAG 2.2 Level AA." />
      <Prose>
        <h2>What we do</h2>
        <ul>
          <li>Keyboard support throughout, including exam shortcuts (1–4 or A–D to answer, Enter for next).</li>
          <li>Visible focus indicators, a skip-to-content link and semantic headings and landmarks.</li>
          <li>Text alternatives for every voice feature; you can always type instead of speaking.</li>
          <li>Respect for reduced-motion settings and system light/dark mode.</li>
          <li>Timers announced to assistive technology; timed exams state their limits before you start.</li>
        </ul>
        <h2>Known limitations</h2>
        <ul>
          <li>Voice input depends on your browser&apos;s speech recognition and isn&apos;t available in every browser.</li>
          <li>Live quiz night updates every couple of seconds and may be harder to follow with a screen reader.</li>
          <li>We haven&apos;t completed an independent accessibility audit yet.</li>
        </ul>
        <h2>Need an accommodation or found a barrier?</h2>
        <p>
          Email <a href={`mailto:${env.supportEmail}`}>{env.supportEmail}</a>. We&apos;ll respond within 5 business days.
        </p>
      </Prose>
    </PublicPage>
  );
}
