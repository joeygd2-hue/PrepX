import { requireUser } from "@/server/auth/session";
import { OrgScope } from "@/components/app/org-theme";
import { AskAi } from "@/components/app/ask-ai";
import type { OrgId } from "@/lib/orgs";

/**
 * Focus-mode study screens (exam runner and review) keep the organization theme and Ask AI.
 * The runner switches Ask AI off on timed questions with data-ask-ai="off".
 */
export default async function FocusStudyLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const p = user.profile!;
  const org = (p.focusOrg ?? p.orgInterests[0] ?? "deca") as OrgId;
  return (
    <OrgScope org={org} sync>
      {children}
      <AskAi />
    </OrgScope>
  );
}
