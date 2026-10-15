import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { activeSelection } from "@/server/progress";
import { getAllowance } from "@/server/entitlements";
import { features } from "@/lib/env";
import { BackHeader, Page } from "@/components/ui/page";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/form";
import { CheckForm } from "./form";

export const metadata: Metadata = { title: "Entry check" };

export default async function Check({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const user = await requireUser();
  const { type } = await searchParams;
  const kind = type === "presentation" ? "presentation" : "entry";
  const sel = await activeSelection(user.id);
  const allowance = await getAllowance(user.id, kind === "entry" ? "entry_check" : "presentation_check", user.profile!.timezone);
  const applicable = sel && (kind === "entry" ? sel.event.components.written : sel.event.components.presentation);
  return (
    <Page>
      <BackHeader href="/study" title={kind === "entry" ? "Written entry check" : "Presentation check"} subtitle={sel ? `${sel.event.code} · ${sel.event.name}` : undefined} />
      {!sel ? <Notice>Choose your event first.</Notice> : null}
      {sel && !applicable ? <Notice tone="warning">Your event doesn&apos;t list a {kind === "entry" ? "written entry" : "presentation"} component, so this check may not apply.</Notice> : null}
      {!features.ai() ? <Notice tone="warning" className="mt-3">AI features aren&apos;t configured on this server yet.</Notice> : null}
      {sel ? (
        <>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted">
            Paste {kind === "entry" ? "your written entry (or one section of it)" : "your presentation outline, script or speaker notes"}. You&apos;ll get feedback on each practice criterion and
            concrete next steps. Your text is sent to our AI provider for review and saved with your feedback; you can delete it from History.
          </p>
          <CheckForm type={kind} remaining={allowance.unlimited ? null : allowance.remaining} resets={allowance.resets} />
        </>
      ) : (
        <ButtonLink href="/study/events" variant="outline" className="mt-4">
          Browse events <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-0.5" aria-hidden />
        </ButtonLink>
      )}
    </Page>
  );
}
