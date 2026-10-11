import type { Metadata } from "next";
import { ArrowRight, ChartColumn, KeyRound, Megaphone, ShieldCheck, Trophy } from "lucide-react";
import { PublicPage, PublicTitle } from "@/components/shell/public-page";
import { ButtonLink } from "@/components/ui/button";
import { Card, HeroTexture, IconTile, SectionLabel } from "@/components/ui/card";
import { Accent } from "@/components/ui/page";

export const metadata: Metadata = { title: "For advisors" };

const STEPS = [
  { icon: KeyRound, body: "Create your chapter and share its 6-character join code. You can set the code to expire, regenerate it, or turn joining off." },
  { icon: Megaphone, body: "Promote students to board members so they can post announcements and open meeting check-ins." },
  { icon: Trophy, body: "Students earn chapter points for check-ins and quiz nights; an opt-in chapter leaderboard keeps it fun." },
  { icon: ChartColumn, body: "See weekly practice activity for students who choose to share it. You never see their email, birthday or private AI conversations." },
];

export default function Advisors() {
  return (
    <PublicPage wide>
      <PublicTitle
        title={
          <>
            For <Accent>advisors</Accent>
          </>
        }
        lead="Run your chapter's season in one place: join codes, meeting check-ins, announcements, quiz night and student practice."
      >
        <ButtonLink href="/sign-in" size="lg" className="mt-8">
          Get started <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-0.5" aria-hidden />
        </ButtonLink>
      </PublicTitle>
      <section aria-labelledby="how-it-works">
        <SectionLabel id="how-it-works" className="mt-0">
          How it works
        </SectionLabel>
        <ol className="stagger grid gap-3 sm:grid-cols-2">
          {STEPS.map(({ icon: Icon, body }, i) => (
            <li key={body}>
              <Card className="h-full">
                <div className="flex items-center justify-between gap-3">
                  <IconTile>
                    <Icon />
                  </IconTile>
                  <span className="font-mono text-xs text-muted tabular" aria-hidden>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <p className="mt-5 text-[15px] leading-relaxed">{body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Card tone="subtle" className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <IconTile inverse>
            <ShieldCheck />
          </IconTile>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-[-0.02em]">Student privacy</h2>
            <p className="mt-1.5 text-[15px] leading-relaxed text-muted">
              PrepX is for ages 13+. Students control what they share, leaderboards are opt-in, and data can be exported or deleted at any time.
            </p>
          </div>
        </Card>
        <Card tone="inverse" className="shadow-float">
          <HeroTexture />
          <div className="relative">
            <h2 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.03em]">
              Chapter <Accent>Pro</Accent>
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-hero-muted">Chapters can cover Pro for their members. Contact us to set this up.</p>
          </div>
        </Card>
      </div>
    </PublicPage>
  );
}
