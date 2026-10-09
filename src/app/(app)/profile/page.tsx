import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { Accessibility, Download, FileText, Gem, LifeBuoy, LogOut, Megaphone, MessageSquare, Shield, ShieldCheck, Trash2, Trophy } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { streakSummary, syncAchievements, xpSummary } from "@/server/progress";
import { getPlanStatus } from "@/server/entitlements";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { ACCENTS } from "@/lib/levels";
import { env, features } from "@/lib/env";
import { Page } from "@/components/ui/page";
import { SectionLabel } from "@/components/ui/card";
import { ListGroup, ListRow } from "@/components/ui/list";
import { Avatar, initials } from "@/components/app/avatar";
import { LevelCard } from "@/components/app/level-card";
import { ProfileForm, AccentPicker, NotificationToggles, PushCard, FamilyCard, PrivacyToggles, SignOutRow } from "./client";

export const metadata: Metadata = { title: "Profile" };

export default async function Profile() {
  const user = await requireUser();
  const p = user.profile!;
  const tz = p.timezone;
  await syncAchievements(user.id, tz);
  const [xp, streak, earned, prefs, family, plan] = await Promise.all([
    xpSummary(user.id, tz),
    streakSummary(user.id, tz),
    db.select().from(schema.userAchievements).where(eq(schema.userAchievements.userId, user.id)),
    db.select().from(schema.notificationPrefs).where(eq(schema.notificationPrefs.userId, user.id)),
    db.select().from(schema.familyLinks).where(eq(schema.familyLinks.studentId, user.id)),
    getPlanStatus(user.id),
  ]);
  const have = new Set(earned.map((e) => e.achievementId));
  const pref = prefs[0];
  return (
    <Page>
      <header className="flex flex-col items-center text-center">
        <Avatar text={initials(p.firstName, p.lastName)} size="lg" />
        <h1 className="mt-4 text-2xl font-semibold">
          {p.firstName} {p.lastName}
        </h1>
        <p className="text-muted">{p.grade && p.grade <= 12 ? `Grade ${p.grade}` : p.grade === 13 ? "Graduate" : ""}</p>
        {user.role !== "student" ? (
          <Link href="/admin" className="mt-2 text-sm font-medium underline">
            Admin console
          </Link>
        ) : null}
      </header>

      <SectionLabel>Profile</SectionLabel>
      <ProfileForm initial={{ firstName: p.firstName, lastName: p.lastName, displayName: p.displayName, school: p.school ?? "", grade: p.grade ?? 10, dailyStudyMinutes: p.dailyStudyMinutes }} />

      <div className="mt-4">
        <LevelCard level={xp.level} total={xp.total} week={xp.week} />
      </div>

      <SectionLabel>App color</SectionLabel>
      <AccentPicker current={p.accentColor} level={xp.level.level} accents={ACCENTS.map((a) => ({ ...a }))} />
      <p className="mt-3 text-sm text-muted">Unlock a new color at each level.</p>

      <SectionLabel id="achievements">Badges</SectionLabel>
      <p className="mb-3 text-sm text-muted">
        Current streak: <span className="font-semibold text-fg">{streak.current}</span> day{streak.current === 1 ? "" : "s"} · longest {streak.longest}
      </p>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {ACHIEVEMENTS.map((a) => {
          const ok = have.has(a.id);
          return (
            <li key={a.id} className={`flex flex-col items-center rounded-2xl p-3 text-center ${ok ? "bg-subtle" : "opacity-50"}`} title={a.description}>
              <span className={`inline-flex size-11 items-center justify-center rounded-full ${ok ? "bg-fg text-bg" : "border border-dashed border-border"}`} aria-hidden>
                <Trophy className="size-5" />
              </span>
              <span className="mt-2 text-xs font-medium">{a.label}</span>
              <span className="sr-only">{ok ? "Earned" : "Locked"}: {a.description}</span>
            </li>
          );
        })}
      </ul>

      <SectionLabel>Notifications</SectionLabel>
      <div className="rounded-3xl border border-border px-5">
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
      </div>

      <SectionLabel>Family and sharing</SectionLabel>
      <FamilyCard link={family[0] ? { email: family[0].parentEmail, status: family[0].status } : null} />

      <SectionLabel>Privacy</SectionLabel>
      <div className="rounded-3xl border border-border px-5">
        <PrivacyToggles
          hideName={p.hideNameOnTrophies}
          share={p.shareActivityWithChapter}
          leaderboard={p.leaderboardVisibility}
          competitionEmails={pref?.competitionReminderEmails ?? true}
          productEmails={pref?.productUpdatesEmail ?? false}
          trophyUrl={`/trophies/${p.publicTrophyId}`}
        />
      </div>
      <ListGroup className="mt-4">
        <ListRow href="/api/me/export" external icon={<Download />} title="Download my data" />
        <ListRow href="/privacy" icon={<Shield />} title="Privacy Policy" />
        <ListRow href="/terms" icon={<FileText />} title="Terms of Service" />
        <ListRow href="/accessibility" icon={<Accessibility />} title="Accessibility" />
      </ListGroup>
      <p className="mt-3 text-sm text-muted">
        Privacy questions or a parent&apos;s request:{" "}
        <a className="underline" href={`mailto:${env.privacyEmail}`}>
          {env.privacyEmail}
        </a>
      </p>

      <SectionLabel>Account</SectionLabel>
      <ListGroup>
        <ListRow href="/profile/plan" icon={<Gem />} title="Your plan" subtitle={plan.isPro ? `Pro · ${plan.source === "chapter" ? `covered by ${plan.detail}` : plan.source === "season_boost" ? "season boost" : "subscription"}` : "Free · Pro, season boosts and what your chapter covers"} />
        <ListRow href="/profile/ambassador" icon={<Megaphone />} title="Ambassador program" subtitle="Bring PrepX to other schools" />
        <ListRow href="/profile/feedback" icon={<MessageSquare />} title="Send feedback" subtitle="Report a bug or share an idea" />
        <ListRow href={`mailto:${env.supportEmail}`} external icon={<LifeBuoy />} title="Email support" subtitle={env.supportEmail} />
        {user.role !== "student" ? <ListRow href="/admin" icon={<ShieldCheck />} title="Admin console" /> : null}
        <SignOutRow icon={<LogOut />} />
        <ListRow href="/profile/delete" icon={<Trash2 className="text-danger" />} title="Delete my account" danger />
      </ListGroup>
      <p className="mt-8 text-center text-sm text-muted">
        PrepX 0.1.0
        <br />
        Not affiliated with any competition organization.
      </p>
    </Page>
  );
}
