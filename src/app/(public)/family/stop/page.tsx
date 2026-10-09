import type { Metadata } from "next";
import { PublicPage } from "@/components/shell/public-page";
import { StopButton } from "./stop";

export const metadata: Metadata = { title: "Stop monthly email", robots: { index: false } };

export default async function Stop({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <PublicPage>
      <h1 className="text-3xl font-semibold">Stop monthly progress emails?</h1>
      <p className="mt-3 text-muted">You won&apos;t receive any more PrepX progress emails for this student. They can invite you again later.</p>
      {token ? <StopButton token={token} /> : <p className="mt-6 text-muted">This link is missing its token.</p>}
    </PublicPage>
  );
}
