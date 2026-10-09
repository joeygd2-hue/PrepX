import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Bell } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { BackHeader, Page, EmptyState } from "@/components/ui/page";
import { markNotificationsRead } from "@/app/actions/profile";

export const metadata: Metadata = { title: "Notifications" };

export default async function Notifications() {
  const user = await requireUser();
  const rows = await db.select().from(schema.notifications).where(eq(schema.notifications.userId, user.id)).orderBy(desc(schema.notifications.createdAt)).limit(50);
  const unread = rows.filter((r) => !r.readAt).length;
  return (
    <Page>
      <BackHeader href="/" title="Notifications" />
      {unread ? (
        <form action={markNotificationsRead} className="mb-4 text-right">
          <button className="text-sm font-medium">Mark all read</button>
        </form>
      ) : null}
      {rows.length ? (
        <ul className="divide-y divide-border rounded-3xl border border-border px-5">
          {rows.map((n) => (
            <li key={n.id}>
              <Link href={n.href ?? "/"} className="-mx-5 flex gap-3 px-5 py-4 hover:bg-subtle/60">
                <span className={`mt-2 size-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-danger"}`} aria-label={n.readAt ? undefined : "Unread"} />
                <span>
                  <span className="block font-medium">{n.title}</span>
                  {n.body ? <span className="block text-sm text-muted">{n.body}</span> : null}
                  <span className="text-xs text-muted">{n.createdAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<Bell />} title="You're all caught up" body="Chapter announcements, check-ins, badges and reminders show up here." />
      )}
    </Page>
  );
}
