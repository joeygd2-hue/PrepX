import Link from "next/link";
import { House } from "lucide-react";
import { requireRole } from "@/server/auth/session";
import { LogoMark } from "@/components/shell/logo";
import { AdminNav } from "./nav";

const NAV: [string, string][] = [
  ["/admin", "Overview"],
  ["/admin/competitions", "Dates"],
  ["/admin/announcements", "Announcements"],
  ["/admin/events", "Events"],
  ["/admin/questions", "Questions"],
  ["/admin/chapters", "Chapters"],
  ["/admin/feedback", "Feedback"],
  ["/admin/limits", "Plan limits"],
  ["/admin/users", "Users"],
  ["/admin/health", "Health"],
];

export const metadata = { title: { default: "Admin", template: "%s · Admin · PrepX" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["staff", "admin"]);
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/admin" className="flex min-w-0 items-center gap-2.5 rounded-[12px]">
            <LogoMark className="size-8 shrink-0" />
            <span className="truncate text-[1.05rem] font-semibold tracking-[-0.03em]">
              Prep<span className="font-display text-[1.15em] font-normal italic tracking-normal">X</span> Admin
            </span>{" "}
            <span className="inline-flex h-6 shrink-0 items-center rounded-full border border-border-strong px-2.5 font-mono text-[11px] font-medium uppercase tracking-wider text-muted">
              {user.role}
            </span>
          </Link>
          <Link
            href="/"
            className="inline-flex size-10 shrink-0 items-center justify-center gap-1.5 rounded-[12px] border border-border bg-card text-sm font-medium shadow-card transition-colors hover:border-border-strong sm:w-auto sm:px-3.5"
          >
            <House className="size-4" aria-hidden />
            <span className="sr-only sm:not-sr-only">Back to app</span>
          </Link>
        </div>
        <AdminNav items={NAV} />
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-24 pt-8 sm:px-6 sm:pt-10">
        {children}
      </main>
    </div>
  );
}
