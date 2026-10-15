import { BottomNav } from "@/components/shell/bottom-nav";
import { requireUser } from "@/server/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <>
      {children}
      <BottomNav />
    </>
  );
}
