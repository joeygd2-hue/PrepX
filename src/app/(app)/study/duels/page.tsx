import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Clock, Hourglass, Swords, Trophy } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { activeSelection } from "@/server/progress";
import { DUEL_QUESTIONS, duelBankSize, duelBuddies, listDuels, type DuelSummary } from "@/server/duels";
import { Accent, BackHeader, Page } from "@/components/ui/page";
import { Card, HeroTexture, SectionLabel } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { ListGroup, ListRow } from "@/components/ui/list";
import { Notice } from "@/components/ui/form";
import { ChallengeForm, JoinForm } from "./duel-forms";

export const metadata: Metadata = { title: "Duels" };

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

function opponentLabel(d: DuelSummary) {
  return d.opponentName ? `vs ${d.opponentName}` : "Open invite";
}

function pendingSubtitle(d: DuelSummary) {
  const left = d.timeLeft.toLowerCase();
  if (d.waitingOn === "you") return `${d.clusterName} · ${d.myState === "playing" ? "in progress" : "your turn"} · ${left}`;
  if (!d.opponentName) return `${d.clusterName} · ${d.code ? `code ${d.code}` : "waiting for a challenger"} · ${left}`;
  return `${d.clusterName} · ${d.theirState === "new" ? "they haven't started" : "they're playing"} · ${left}`;
}

function ResultChip({ d }: { d: DuelSummary }) {
  if (d.result) {
    const label = d.result.outcome === "won" ? "Won" : d.result.outcome === "lost" ? "Lost" : "Draw";
    return (
      <Chip tone={d.result.outcome === "won" ? "accent" : "outline"} className="shrink-0 font-mono tabular">
        {label} {d.result.mine}–{d.result.theirs}
      </Chip>
    );
  }
  return <Chip className="shrink-0 text-muted">{d.status === "declined" ? "Declined" : "Expired"}</Chip>;
}

export default async function DuelsPage({ searchParams }: { searchParams: Promise<{ exam?: string | string[] }> }) {
  const user = await requireUser();
  const { exam: rawExam } = await searchParams;
  // A repeated ?exam= arrives as an array; only a single bank id is meaningful.
  if (Array.isArray(rawExam)) notFound();
  const exam = rawExam || undefined;
  const clusterId = exam ?? (await activeSelection(user.id))?.event.components.exam?.clusterId ?? null;
  const [cluster] = clusterId ? await db.select({ id: schema.examClusters.id, name: schema.examClusters.name }).from(schema.examClusters).where(eq(schema.examClusters.id, clusterId)) : [];
  if (exam && !cluster) notFound();
  const [bank, buddies, duels] = await Promise.all([cluster ? duelBankSize(cluster.id) : 0, duelBuddies(user.id), listDuels(user.id)]);
  const tz = user.profile!.timezone;
  const pending = [...duels.yourTurn, ...duels.theirTurn];
  // Expired and declined duels weren't played out, so they don't count toward the record.
  const played = duels.results.filter((d) => d.result);
  const wins = played.filter((d) => d.result?.outcome === "won").length;

  return (
    <Page>
      <BackHeader href="/study" title="Duels" subtitle={cluster?.name ?? "Head-to-head practice"} />

      <Card tone="inverse" className="rounded-[28px] p-6 shadow-float sm:p-8">
        <HeroTexture />
        <div className="relative">
          <p className="eyebrow text-hero-muted">Duels</p>
          <h1 className="mt-2 text-[2rem] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[2.4rem]">
            Head-to-head <Accent>duels</Accent>
          </h1>
          <p className="mt-3 text-hero-muted">Same {DUEL_QUESTIONS} questions as a friend · most right wins. Ties go to whoever finished faster.</p>
          {played.length ? (
            <p className="mt-5 flex items-center gap-2 text-sm text-hero-muted">
              <Trophy className="size-4 text-accent" aria-hidden />
              <span>
                <span className="font-mono font-medium tabular text-hero-fg">{wins}</span> {wins === 1 ? "win" : "wins"} in your last {plural(played.length, "finished duel")}
            </p>
          ) : null}
        </div>
      </Card>

      <SectionLabel>Challenge a friend</SectionLabel>
      {!cluster ? (
        <Notice>
          <span>
            Pick a study bank first. Open a bank from{" "}
            <Link href="/study" className="font-semibold underline underline-offset-2">
              Study
            </Link>{" "}
            and choose Duels.
          </span>
        </Notice>
      ) : bank < DUEL_QUESTIONS ? (
        <Notice tone="warning">
          Duels need at least {DUEL_QUESTIONS} practice questions, and {cluster.name} has {bank} so far. Try a duel in another bank while we add more.
        </Notice>
      ) : (
        <Card>
          <p className="text-[15px]">
            {DUEL_QUESTIONS} random questions from <span className="font-medium">{cluster.name}</span>. You both get a week to play.
          </p>
          {buddies.length ? null : (
            <p className="mt-1 text-sm text-muted">
              Add{" "}
              <Link href="/buddies" className="font-medium text-fg underline underline-offset-2">
                study buddies
              </Link>{" "}
              to challenge them directly.
            </p>
          )}
          <div className="mt-4">
            <ChallengeForm exam={cluster.id} buddies={buddies} />
          </div>
        </Card>
      )}

      <SectionLabel>Have a code?</SectionLabel>
      <Card tone="subtle">
        <JoinForm />
      </Card>

      <SectionLabel>Your duels</SectionLabel>
      {pending.length ? (
        <ListGroup className="stagger">
          {pending.map((d) => (
            <ListRow
              key={d.id}
              href={`/study/duels/${d.id}`}
              icon={d.waitingOn === "you" ? <Swords className="size-[18px]" aria-hidden /> : <Hourglass className="size-[18px]" aria-hidden />}
              title={opponentLabel(d)}
              subtitle={pendingSubtitle(d)}
              right={
                d.waitingOn === "you" ? (
                  <Chip tone="accent" className="shrink-0">
                    Your turn
                  </Chip>
                ) : (
                  <Chip className="shrink-0 text-muted">Waiting</Chip>
                )
              }
            />
          ))}
        </ListGroup>
      ) : (
        <p className="text-sm text-muted">No duels in progress. Challenge a friend above, or join with a code.</p>
      )}

      {duels.results.length ? (
        <>
          <SectionLabel>Recent results</SectionLabel>
          <ListGroup className="stagger">
            {duels.results.map((d) => (
              <ListRow
                key={d.id}
                href={`/study/duels/${d.id}`}
                icon={d.result ? <Trophy className="size-[18px]" aria-hidden /> : <Clock className="size-[18px]" aria-hidden />}
                title={opponentLabel(d)}
                subtitle={`${d.clusterName} · ${d.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: tz })}`}
                right={<ResultChip d={d} />}
              />
            ))}
          </ListGroup>
        </>
      ) : null}
    </Page>
  );
}
