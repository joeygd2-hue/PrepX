import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Minus, X } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { DuelError, getDuel, type DuelView } from "@/server/duels";
import { env } from "@/lib/env";
import { cn } from "@/lib/cn";
import { BackHeader, Page } from "@/components/ui/page";
import { Card, HeroTexture, SectionLabel } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { DeclineDuelForm, ShareCode, StartDuelForm } from "../duel-forms";

export const metadata: Metadata = { title: "Duel" };

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

function headline(d: DuelView) {
  const them = d.them.name ?? "your opponent";
  if (d.status === "finished" && d.outcome) {
    const sameScore = d.me.score && d.them.score && d.me.score.correct === d.them.score.correct;
    if (d.outcome === "draw") return { title: "It's a draw", note: "Same score, same time." };
    if (d.outcome === "won") return { title: "You won!", note: sameScore ? "Same score, but you were faster." : "Nice work." };
    return { title: `${them} won`, note: sameScore ? `Same score, but ${them} was faster.` : "Rematch?" };
  }
  if (d.status === "finished") return { title: "Duel over", note: "Your opponent is no longer on PrepX." };
  if (d.status === "expired") return { title: "This duel expired", note: "Duels close a week after they're created." };
  if (d.status === "declined") return { title: "Challenge declined", note: "No worries. Start a new duel any time." };
  if (d.me.state !== "done") return { title: d.me.state === "playing" ? "Finish your round" : "Your turn", note: `${d.questionCount} questions with instant feedback. Most right wins.` };
  if (!d.them.joined) return { title: "Waiting for a challenger", note: "Share your code below. You'll get a notification when they finish." };
  return { title: `Waiting for ${them}`, note: "You'll get a notification when they finish." };
}

function statusChip(d: DuelView) {
  if (d.status === "finished") return "Finished";
  if (d.status === "expired") return "Expired";
  if (d.status === "declined") return "Declined";
  return d.timeLeft;
}

function Player({ label, state, score, total, hidden }: { label: string; state: DuelView["me"]["state"] | "none"; score: { correct: number; elapsedSec: number } | null; total: number; hidden?: boolean }) {
  return (
    <div className="min-w-0 rounded-[16px] border border-hero-line p-4">
      <p className="truncate text-sm font-medium">{label}</p>
      {score ? (
        <>
          <p className="mt-2 font-mono text-[2.25rem] font-medium leading-none tabular tracking-[-0.04em]">
            {score.correct}
            <span className="text-lg text-hero-muted">/{total}</span>
          </p>
          <p className="mt-1.5 font-mono text-xs text-hero-muted tabular">{clock(score.elapsedSec)}</p>
        </>
      ) : (
        <p className="mt-2 text-sm text-hero-muted">
          {state === "none" ? "Not joined yet" : state === "new" ? "Not started" : state === "playing" ? "Playing" : hidden ? "Finished · score hidden until you finish" : "Finished"}
        </p>
      )}
    </div>
  );
}

function Mark({ value, who }: { value: boolean | null; who: string }) {
  const label = value === true ? `${who}: correct` : value === false ? `${who}: wrong` : `${who}: no answer`;
  return (
    <span className={cn("inline-flex size-8 items-center justify-center rounded-full", value === true ? "bg-success/10 text-success" : value === false ? "bg-danger/10 text-danger" : "bg-subtle text-muted")}>
      {value === true ? <Check className="size-4" strokeWidth={3} aria-hidden /> : value === false ? <X className="size-4" strokeWidth={3} aria-hidden /> : <Minus className="size-4" aria-hidden />}
      <span className="sr-only">{label}</span>
    </span>
  );
}

export default async function DuelPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  let d: DuelView;
  try {
    d = await getDuel(user.id, id);
  } catch (e) {
    if (e instanceof DuelError) notFound();
    throw e;
  }
  const h = headline(d);
  const open = d.status === "open" || d.status === "active";
  const themLabel = d.them.name ?? "Opponent";

  return (
    <Page>
      <BackHeader href={`/study/duels?exam=${encodeURIComponent(d.clusterId)}`} title={d.them.name ? `You vs ${d.them.name}` : "Duel"} subtitle={d.clusterName} />

      <Card tone="inverse" className="rounded-[28px] p-6 shadow-float sm:p-8">
        <HeroTexture />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={d.outcome === "won" ? "accent" : "inverse"}>{statusChip(d)}</Chip>
            <Chip tone="inverse">{d.questionCount} questions</Chip>
          </div>
          <h1 className="mt-4 text-[1.9rem] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[2.3rem]">{h.title}</h1>
          <p className="mt-2 text-hero-muted">{h.note}</p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Player label="You" state={d.me.state} score={d.me.score} total={d.questionCount} />
            <Player label={themLabel} state={d.them.joined ? d.them.state : "none"} score={d.them.score} total={d.questionCount} hidden={d.me.state !== "done"} />
          </div>

          {open && (d.canStart || d.me.state === "playing" || d.canDecline) ? (
            <div className="mt-6 space-y-3">
              {d.canStart ? <StartDuelForm id={d.id} label={d.role === "opponent" && d.canDecline ? "Accept and start" : "Start duel"} /> : null}
              {d.me.state === "playing" && d.me.attemptId ? (
                <ButtonLink href={`/study/attempt/${d.me.attemptId}`} variant="accent" size="lg" block>
                  Continue your round <ArrowRight className="size-5 transition-transform group-hover/btn:translate-x-0.5" aria-hidden />
                </ButtonLink>
              ) : null}
              {d.canDecline ? <DeclineDuelForm id={d.id} /> : null}
            </div>
          ) : null}
        </div>
      </Card>

      {d.code ? (
        <>
          <SectionLabel>Invite a friend</SectionLabel>
          <Card>
            <p className="text-sm text-muted">Duel code</p>
            <p className="mt-1 font-mono text-[2rem] font-medium tracking-[0.18em] tabular">{d.code}</p>
            <p className="mt-1 text-sm text-muted">Anyone with this code can join · one opponent per duel · {d.timeLeft.toLowerCase()}</p>
            <div className="mt-4">
              <ShareCode code={d.code} link={`${env.appUrl}/study/duels/join?code=${d.code}`} questions={d.questionCount} />
            </div>
          </Card>
        </>
      ) : null}

      {d.comparison ? (
        <>
          <SectionLabel>Question by question</SectionLabel>
          <Card className="px-4 py-2 sm:px-5">
            <div className="flex items-center gap-3 border-b border-border py-2.5 text-xs text-muted">
              <span className="flex-1">Question</span>
              <span className="w-8 text-center">You</span>
              <span className="w-8 text-center" title={themLabel}>
                Them
              </span>
            </div>
            <ol className="stagger divide-y divide-border">
              {d.comparison.map((q, i) => (
                <li key={q.id} className="flex items-center gap-3 py-3">
                  <span className="w-5 shrink-0 font-mono text-xs text-muted tabular">{i + 1}</span>
                  <p className="line-clamp-2 min-w-0 flex-1 text-sm leading-snug">{q.stem}</p>
                  <Mark value={q.mine} who="You" />
                  <Mark value={q.theirs} who={themLabel} />
                </li>
              ))}
            </ol>
          </Card>
        </>
      ) : null}

      {d.me.state === "done" && d.me.attemptId ? (
        <ButtonLink href={`/study/attempt/${d.me.attemptId}/review`} variant="outline" size="sm" className="mt-3 h-11">
          Review your answers <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-0.5" aria-hidden />
        </ButtonLink>
      ) : null}

      <p className="mt-8 text-sm text-muted">
        Both players get the same {d.questionCount} questions. Most right wins; a tie goes to whoever finished faster. Scores stay hidden until you&apos;ve both played.
      </p>
    </Page>
  );
}
