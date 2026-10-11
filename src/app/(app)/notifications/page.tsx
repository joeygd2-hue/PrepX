import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Bell, CheckCheck, ChevronRight } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth/session";
import { BackHeader, Page, EmptyState } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
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
        <form action={markNotificationsRead} className="-mt-3 mb-3 flex justify-end">
          <Button size="sm" variant="ghost">
            <CheckCheck className="size-4" aria-hidden /> Mark all read
          </Button>
        </form>
      ) : null}
      {rows.length ? (
        <ul className="stagger divide-y divide-border overflow-hidden rounded-[24px] border border-border bg-card px-4 shadow-card sm:px-5">
          {rows.map((n) => (
            <li key={n.id}>
              <Link href={n.href ?? "/"} className="group/row -mx-4 flex gap-3.5 px-4 py-4 transition-colors hover:bg-subtle/60 sm:-mx-5 sm:px-5">
                <span
                  className={cn(
                    "mt-[0.45rem] size-2 shrink-0 rounded-full",
                    n.readAt ? "bg-transparent" : "bg-accent shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--fg)_25%,transparent)]",
                  )}
                  role={n.readAt ? undefined : "img"}
                  aria-label={n.readAt ? undefined : "Unread"}
                />
                <span className="min-w-0 flex-1">
                  <span className={cn("block tracking-[-0.01em]", n.readAt ? "font-medium text-fg/80" : "font-semibold")}>{n.title}</span>
                  {n.body ? <span className="mt-0.5 block text-sm leading-relaxed text-muted">{n.body}</span> : null}
                  <span className="mt-1.5 block font-mono text-[11px] uppercase tracking-[0.08em] text-muted tabular">
                    {n.createdAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </span>
                </span>
                <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted transition-transform duration-200 group-hover/row:translate-x-0.5 group-hover/row:text-fg" aria-hidden />
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
