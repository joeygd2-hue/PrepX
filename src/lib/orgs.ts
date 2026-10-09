export type OrgId = "deca" | "fbla" | "hosa" | "tsa";
export const ORG_IDS: OrgId[] = ["deca", "fbla", "hosa", "tsa"];

export const ORGS: Record<OrgId, { name: string; fullName: string; color: string; searchHint: string; sectionLabel: string }> = {
  deca: { name: "DECA", fullName: "DECA", color: "#0B5FA5", searchHint: "e.g. finance, PFL, marketing", sectionLabel: "DECA" },
  fbla: { name: "FBLA", fullName: "Future Business Leaders of America", color: "#1F3A73", searchHint: "e.g. accounting, coding, public speaking", sectionLabel: "Future Business Leaders of America" },
  hosa: { name: "HOSA", fullName: "HOSA-Future Health Professionals", color: "#7A1E3A", searchHint: "e.g. medical terminology, CPR", sectionLabel: "HOSA-Future Health Professionals" },
  tsa: { name: "TSA", fullName: "Technology Student Association", color: "#C8102E", searchHint: "e.g. coding, drones, architecture", sectionLabel: "Technology Student Association" },
};

export const isOrg = (s: unknown): s is OrgId => typeof s === "string" && (ORG_IDS as string[]).includes(s);
