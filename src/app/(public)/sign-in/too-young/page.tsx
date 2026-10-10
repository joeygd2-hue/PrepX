import { PublicFooter, PublicHeader } from "@/components/shell/public-footer";
import { ButtonLink } from "@/components/ui/button";
import { Accent } from "@/components/ui/page";

export const metadata = { title: "PrepX is for ages 13+" };

export default function TooYoung() {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main id="main" className="mx-auto w-full max-w-xl flex-1 px-4 py-16 sm:px-6 sm:py-24">
        <p className="eyebrow">Ages 13+</p>
        <h1 className="mt-4 text-[2.4rem] font-semibold leading-[1.02] tracking-[-0.04em] sm:text-5xl">
          PrepX is for people <Accent>13 and older</Accent>
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-muted">
          We weren&apos;t able to create your account, and we didn&apos;t keep the information you entered. If you&apos;re a middle school competitor, ask your advisor about
          resources from your organization.
        </p>
        <ButtonLink href="/sign-in" variant="outline" className="mt-10">
          Back to start
        </ButtonLink>
      </main>
      <PublicFooter />
    </div>
  );
}
