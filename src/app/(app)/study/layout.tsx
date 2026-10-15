import { requireUser } from "@/server/auth/session";
import { OrgScope } from "@/components/app/org-theme";
import { AskAi } from "@/components/app/ask-ai";
import type { OrgId } from "@/lib/orgs";

/** The Study area wears the colors of the organization the student is studying for, and offers Ask AI on highlighted text. */
export default async function StudyLayout({ children }: { children: React.ReactNode }) {
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
