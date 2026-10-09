import Link from "next/link";
import { requireRole } from "@/server/auth/session";

const NAV = [
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
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/admin" className="font-semibold">
            PrepX Admin <span className="ml-2 rounded-full bg-subtle px-2 py-0.5 text-xs">{user.role}</span>
          </Link>
          <Link href="/" className="text-sm underline">
            Back to app
          </Link>
        </div>
        <nav aria-label="Admin" className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-3 sm:px-6">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm hover:bg-subtle">
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
