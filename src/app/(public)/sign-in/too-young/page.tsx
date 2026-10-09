import { PublicFooter, PublicHeader } from "@/components/shell/public-footer";
import { ButtonLink } from "@/components/ui/button";

export const metadata = { title: "PrepX is for ages 13+" };

export default function TooYoung() {
  return (
    <div className="min-h-dvh">
      <PublicHeader />
      <main id="main" className="mx-auto max-w-xl px-4 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">PrepX is for people 13 and older</h1>
        <p className="mt-4 text-muted">
          We weren&apos;t able to create your account, and we didn&apos;t keep the information you entered. If you&apos;re a middle school competitor, ask your advisor about
          resources from your organization.
        </p>
        <ButtonLink href="/sign-in" variant="outline" className="mt-8">
          Back to start
        </ButtonLink>
      </main>
      <PublicFooter />
    </div>
  );
}
