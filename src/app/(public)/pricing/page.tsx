import type { Metadata } from "next";
import { db, schema } from "@/db";
import { PublicPage } from "@/components/shell/public-page";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Pricing" };

export default async function Pricing() {
  const limits = await db.select().from(schema.planLimits);
  const fmt = (n: number, p: string) => (n < 0 ? "Unlimited" : `${n}${p === "day" ? " / day" : p === "season" ? " / season" : ""}`);
  return (
    <PublicPage>
      <h1 className="text-4xl font-bold tracking-tight">Pricing</h1>
      <p className="mt-2 text-muted">Start free. Upgrade for more AI practice, or ask whether your chapter covers Pro. Prices are shown at checkout.</p>
      <div className="mt-8 overflow-hidden rounded-3xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-subtle text-left">
            <tr>
              <th className="px-4 py-3">Feature</th>
              <th className="px-4 py-3">Free</th>
              <th className="px-4 py-3">Pro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {limits.map((l) => (
              <tr key={l.feature}>
                <td className="px-4 py-3">{l.label}</td>
                <td className="px-4 py-3">{fmt(l.freeLimit, l.period)}</td>
                <td className="px-4 py-3">{fmt(l.proLimit, l.period)}</td>
              </tr>
            ))}
            <tr>
              <td className="px-4 py-3">Quick 10, sprints, mistake notebook</td>
              <td className="px-4 py-3">Unlimited</td>
              <td className="px-4 py-3">Unlimited</td>
            </tr>
            <tr>
              <td className="px-4 py-3">Chapters, check-ins, quiz night, calendar</td>
              <td className="px-4 py-3">Included</td>
              <td className="px-4 py-3">Included</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm text-muted">Pro renews monthly until cancelled. A season boost is a one-time purchase that ends July 31. No automatic trial conversions.</p>
      <ButtonLink href="/sign-in" className="mt-8">
        Get started free
      </ButtonLink>
    </PublicPage>
  );
}
