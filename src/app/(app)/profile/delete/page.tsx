import type { Metadata } from "next";
import { requireUser } from "@/server/auth/session";
import { BackHeader, Page } from "@/components/ui/page";
import { DeleteForm } from "./form";

export const metadata: Metadata = { title: "Delete my account" };

export default async function Delete() {
  await requireUser();
  return (
    <Page>
      <BackHeader href="/profile" title="Delete my account" />
      <section className="space-y-4 text-[15px]">
        <p>Deleting your account is permanent. Here&apos;s exactly what happens:</p>
        <div className="rounded-3xl border border-border p-5">
          <h2 className="font-semibold">Deleted right away</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            <li>Your profile, email address, birthday and school</li>
            <li>Study plans, practice attempts, answers, lessons, flashcards and mistake notebook</li>
            <li>AI coach conversations, judge transcripts and feedback</li>
            <li>XP, streaks, badges, buddies, notifications and preferences</li>
            <li>Chapter memberships and check-ins, and any parent email link</li>
          </ul>
        </div>
        <div className="rounded-3xl border border-border p-5">
          <h2 className="font-semibold">Kept</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            <li>Announcements you posted to a chapter stay, without your name.</li>
            <li>If you advise a chapter, advisor rights pass to the next officer or member; an empty chapter is deleted.</li>
            <li>Payment records held by our payment provider (Stripe) are kept as required by law. Any active subscription is cancelled.</li>
            <li>An anonymous record that an account was deleted (no personal details), for security auditing.</li>
          </ul>
        </div>
        <p className="text-muted">Want a copy first? Use Download my data on your Profile.</p>
      </section>
      <DeleteForm />
    </Page>
  );
}
