"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, GraduationCap, House, User, Users } from "lucide-react";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/", label: "Home", icon: House, match: (p: string) => p === "/" || p.startsWith("/buddies") || p.startsWith("/goals") || p.startsWith("/invite") || p.startsWith("/share") || p.startsWith("/notifications") || p.startsWith("/leaderboard") || p.startsWith("/announcements") },
  { href: "/study", label: "Study", icon: GraduationCap, match: (p: string) => p.startsWith("/study") },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, match: (p: string) => p.startsWith("/calendar") },
  { href: "/chapter", label: "Chapter", icon: Users, match: (p: string) => p.startsWith("/chapter") },
  { href: "/profile", label: "Profile", icon: User, match: (p: string) => p.startsWith("/profile") },
];

/** Floating glass dock. The active tab expands into an accent pill with its label. */
export function BottomNav() {
  const path = usePathname() ?? "/";
  return (
    <nav aria-label="Main" className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(env(safe-area-inset-bottom),14px)]">
      <ul className="pointer-events-auto flex items-center gap-1 rounded-[22px] border border-border bg-card/75 p-1.5 shadow-float backdrop-blur-xl backdrop-saturate-150">
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match(path);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-12 items-center justify-center gap-2 rounded-[16px] text-sm font-semibold tracking-[-0.01em] transition-[background-color,color,padding] duration-300 ease-[cubic-bezier(.2,.7,.2,1)]",
                  active ? "bg-accent px-4 text-accent-fg shadow-[0_1px_0_rgba(255,255,255,0.45)_inset]" : "px-3.5 text-muted hover:bg-subtle hover:text-fg md:px-4",
                )}
              >
                <Icon className="size-5 shrink-0" strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                <span className={cn(active ? "inline" : "hidden md:inline")}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
