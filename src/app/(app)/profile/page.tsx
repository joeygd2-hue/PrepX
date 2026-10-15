import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { Accessibility, ArrowUpRight, Award, Download, FileText, Flame, Gem, LifeBuoy, LogOut, Megaphone, MessageSquare, Shield, ShieldCheck, Trash2, TrendingUp, Trophy } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { streakSummary, syncAchievements, xpSummary } from "@/server/progress";
import { getPlanStatus } from "@/server/entitlements";
import { leaderboardAliases } from "@/server/alias";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { ACCENTS } from "@/lib/levels";
import { env, features } from "@/lib/env";
import { cn } from "@/lib/cn";
import { Accent, Page } from "@/components/ui/page";
import { Card, HeroTexture, SectionLabel } from "@/components/ui/card";
import { ListGroup, ListRow } from "@/components/ui/list";
import { ProgressBar } from "@/components/ui/progress";
import { StatStrip } from "@/components/ui/tile";
import { Avatar, initials } from "@/components/app/avatar";
import { ProfileForm, AccentPicker, NotificationToggles, PushCard, FamilyCard, PrivacyToggles, SignOutRow } from "./client";

export const metadata: Metadata = { title: "Profile" };

export default async function Profile() {
  const user = await requireUser();
  const p = user.profile!;
  const tz = p.timezone;
  await syncAchievements(user.id, tz);
  const [xp, streak, earned, prefs, family, plan, aliases] = await Promise.all([
    xpSummary(user.id, tz),
    streakSummary(user.id, tz),
    db.select().from(schema.userAchievements).where(eq(schema.userAchievements.userId, user.id)),
    db.select().from(schema.notificationPrefs).where(eq(schema.notificationPrefs.userId, user.id)),
    db.select().from(schema.familyLinks).where(eq(schema.familyLinks.studentId, user.id)),
    getPlanStatus(user.id),
    leaderboardAliases([user.id]),
  ]);
  const have = new Set(earned.map((e) => e.achievementId));
  const pref = prefs[0];
  const { level } = xp;
  const grade = p.grade && p.grade <= 12 ? `Grade ${p.grade}` : p.grade === 13 ? "Graduate" : "";
  const about = [grade, p.school].filter(Boolean).join(" · ");
  const planSource = { chapter: `covered by ${plan.detail}`, season_boost: "season boost", subscription: "subscription", launch: "free during launch" };
  return (
    <Page>
      <Card tone="inverse" className="p-6 shadow-float sm:p-8">
        <HeroTexture />
        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <Avatar
              text={initials(p.firstName, p.lastName)}
              size="lg"
              className="size-20 rounded-[24px] bg-accent text-[1.65rem] text-accent-fg shadow-none ring-0 ring-offset-0"
            />
            {user.role !== "student" ? (
              <Link
                href="/admin"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-hero-line px-3.5 text-sm font-medium text-hero-fg transition-colors hover:bg-hero-line"
              >
                Admin console <ArrowUpRight className="size-3.5" aria-hidden />
              </Link>
            ) : null}
          </div>
          <h1 className="mt-6 text-[2.15rem] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[2.5rem]">
            {p.firstName} <Accent>{p.lastName}</Accent>
          </h1>
          {about ? <p className="mt-2 text-hero-muted">{about}</p> : null}
          <section aria-label="Level and XP" className="mt-8 border-t border-hero-line pt-5">
            <div className="flex items-end justify-between gap-3">
              <p className="flex items-baseline gap-2.5">
                <span className="font-mono text-xs uppercase tracking-[0.12em] text-hero-muted tabular">Level {level.level}</span>
                <span className="text-lg font-semibold tracking-[-0.02em]">{level.name}</span>
              </p>
              <p className="font-mono text-xs text-hero-muted tabular">+{xp.week} XP this week</p>
            </div>
            <ProgressBar inverse value={level.progress * 100} className="mt-3" label="Progress to next level" />
            <p className="mt-2.5 font-mono text-xs text-hero-muted tabular">
              {xp.total.toLocaleString()} XP{level.next ? ` · ${level.toNext.toLocaleString()} to ${level.next.name}` : " · Top level reached"}
            </p>
          </section>
        </div>
      </Card>

      <StatStrip
        className="mt-3"
        items={[
          { icon: <Flame />, value: String(streak.current), label: "day streak" },
          { icon: <TrendingUp />, value: String(streak.longest), label: "longest" },
          { icon: <Award />, value: `${have.size}/${ACHIEVEMENTS.length}`, label: "badges" },
        ]}
      />

      <SectionLabel id="achievements">Badges</SectionLabel>
      <ul className="stagger grid grid-cols-3 gap-2.5 sm:grid-cols-4">
        {ACHIEVEMENTS.map((a) => {
          const ok = have.has(a.id);
          const Icon = a.group === "streak" ? Flame : Trophy;
          return (
            <li
              key={a.id}
              title={a.description}
              className={cn(
                "flex flex-col items-center rounded-[16px] px-2 py-4 text-center",
                ok ? "border border-border bg-card shadow-card" : "border border-dashed border-border-strong",
              )}
            >
              <span className={cn("inline-flex size-11 items-center justify-center rounded-full", ok ? "bg-accent text-accent-fg" : "bg-subtle text-muted")} aria-hidden>
                <Icon className="size-5" />
              </span>
              <span className={cn("mt-2.5 text-xs font-medium leading-snug", !ok && "text-muted")}>{a.label}</span>
              <span className="sr-only">
                {ok ? "Earned" : "Locked"}: {a.description}
              </span>
            </li>
          );
        })}
      </ul>

      <SectionLabel>App color</SectionLabel>
      <Card>
        <AccentPicker current={p.accentColor} level={level.level} accents={ACCENTS.map((a) => ({ ...a }))} />
        <p className="mt-6 border-t border-border pt-4 text-sm text-muted">Unlock a new color at each level.</p>
      </Card>

      <SectionLabel>Profile</SectionLabel>
      <ProfileForm initial={{ firstName: p.firstName, lastName: p.lastName, displayName: p.displayName, school: p.school ?? "", grade: p.grade ?? 10, dailyStudyMinutes: p.dailyStudyMinutes }} />

      <SectionLabel>Notifications</SectionLabel>
      <ListGroup>
        <PushCard vapidKey={env.push.vapidPublic} configured={features.push()} />
        <NotificationToggles
          prefs={{
            chapterAnnouncements: pref?.chapterAnnouncements ?? true,
            checkinOpen: pref?.checkinOpen ?? true,
            streakReminder: pref?.streakReminder ?? true,
            competitionCountdown: pref?.competitionCountdown ?? true,
            weeklyRecapEmail: pref?.weeklyRecapEmail ?? true,
          }}
        />
      </ListGroup>

      <SectionLabel>Family and sharing</SectionLabel>
      <FamilyCard link={family[0] ? { email: family[0].parentEmail, status: family[0].status } : null} />

      <SectionLabel>Privacy</SectionLabel>
      <ListGroup>
        <PrivacyToggles
          hideName={p.hideNameOnTrophies}
          share={p.shareActivityWithChapter}
          leaderboard={p.leaderboardVisibility}
          alias={aliases.get(user.id) ?? ""}
          competitionEmails={pref?.competitionReminderEmails ?? true}
          productEmails={pref?.productUpdatesEmail ?? false}
          trophyUrl={`/trophies/${p.publicTrophyId}`}
        />
      </ListGroup>
      <ListGroup className="mt-3">
        <ListRow href="/api/me/export" external icon={<Download />} title="Download my data" />
        <ListRow href="/privacy" icon={<Shield />} title="Privacy Policy" />
        <ListRow href="/terms" icon={<FileText />} title="Terms of Service" />
        <ListRow href="/accessibility" icon={<Accessibility />} title="Accessibility" />
      </ListGroup>
      <p className="mt-3 px-1 text-sm text-muted">
        Privacy questions or a parent&apos;s request:{" "}
        <a className="font-medium text-fg underline underline-offset-4" href={`mailto:${env.privacyEmail}`}>
          {env.privacyEmail}
        </a>
      </p>

      <SectionLabel>Account</SectionLabel>
      <ListGroup>
        <ListRow href="/profile/plan" icon={<Gem />} title="Your plan" subtitle={plan.isPro ? `Pro · ${planSource[plan.source ?? "subscription"]}` : "Free · Pro, season boosts and what your chapter covers"} />
        <ListRow href="/profile/ambassador" icon={<Megaphone />} title="Ambassador program" subtitle="Bring PrepX to other schools" />
        <ListRow href="/profile/feedback" icon={<MessageSquare />} title="Send feedback" subtitle="Report a bug or share an idea" />
        <ListRow href={`mailto:${env.supportEmail}`} external icon={<LifeBuoy />} title="Email support" subtitle={env.supportEmail} />
        {user.role !== "student" ? <ListRow href="/admin" icon={<ShieldCheck />} title="Admin console" /> : null}
        <SignOutRow icon={<LogOut />} />
        <ListRow href="/profile/delete" icon={<Trash2 />} title="Delete my account" danger />
      </ListGroup>
      <p className="mt-10 text-center font-mono text-[11px] uppercase leading-relaxed tracking-[0.12em] text-muted">
        PrepX 0.1.0
        <br />
        Not affiliated with any competition organization.
      </p>
    </Page>
  );
}
