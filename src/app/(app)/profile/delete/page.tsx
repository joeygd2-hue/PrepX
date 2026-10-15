import type { Metadata } from "next";
import { requireUser } from "@/server/auth/session";
import { BackHeader, Page } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { DeleteForm } from "./form";

export const metadata: Metadata = { title: "Delete my account" };

const DELETED = [
  "Your profile, email address, birthday and school",
  "Study plans, practice attempts, answers, lessons, flashcards and mistake notebook",
  "AI coach conversations, judge transcripts and feedback",
  "XP, streaks, badges, buddies, notifications and preferences",
  "Chapter memberships and check-ins, and any parent email link",
  "Feedback you've sent and our email delivery records for your address",
];

const KEPT = [
  "Announcements you posted to a chapter stay, without your name.",
  "If you advise a chapter, advisor rights pass to the next officer or member; an empty chapter is deleted.",
  "Payment records held by our payment provider (Stripe) are kept as required by law. Any active subscription is cancelled first; if that fails, nothing is deleted and you can try again.",
  "An anonymous record that an account was deleted (no personal details), for security auditing.",
];

export default async function Delete() {
  await requireUser();
  return (
    <Page>
      <BackHeader href="/profile" title="Delete my account" />
      <section className="space-y-3 text-[15px]">
        <p className="px-1">Deleting your account is permanent. Here&apos;s exactly what happens:</p>
        <Card>
          <h2 className="text-lg font-semibold tracking-[-0.02em]">Deleted right away</h2>
          <List items={DELETED} />
        </Card>
        <Card tone="subtle">
          <h2 className="text-lg font-semibold tracking-[-0.02em]">Kept</h2>
          <List items={KEPT} />
        </Card>
        <p className="px-1 text-muted">Want a copy first? Use Download my data on your Profile.</p>
      </section>
      <Card className="mt-6 border-danger/30">
        <DeleteForm />
      </Card>
    </Page>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 space-y-2.5 text-muted">
      {items.map((t) => (
        <li key={t} className="flex gap-3 leading-relaxed">
          <span aria-hidden className="mt-[0.75em] h-px w-3 shrink-0 bg-muted" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}
