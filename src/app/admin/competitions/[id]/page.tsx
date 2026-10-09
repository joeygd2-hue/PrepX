import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { ActionForm } from "@/components/ui/action-form";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import { saveCompetition } from "@/app/actions/admin";

export const metadata = { title: "Edit date" };

export default async function EditCompetition({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "new";
  const [c] = isNew ? [undefined] : await db.select().from(schema.competitions).where(eq(schema.competitions.id, id));
  if (!isNew && !c) notFound();
  const regions = await db.select().from(schema.regions).orderBy(asc(schema.regions.position));
  const field = (name: string, label: string, el: React.ReactNode) => (
    <div>
      <Label htmlFor={name}>{label}</Label>
      {el}
    </div>
  );
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-semibold">{isNew ? "Add competition date" : c!.name}</h1>
      <ActionForm action={saveCompetition} className="mt-6 space-y-4">
        {isNew ? <input type="hidden" name="isNew" value="1" /> : <input type="hidden" name="id" value={c!.id} />}
        {isNew ? field("id", "ID (e.g. deca-tx-state-2027)", <Input id="id" name="id" required pattern="[a-z0-9-]{3,60}" />) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          {field(
            "org",
            "Organization",
            <Select id="org" name="org" defaultValue={c?.org ?? "deca"}>
              {["deca", "fbla", "hosa", "tsa"].map((o) => (
                <option key={o} value={o}>
                  {o.toUpperCase()}
                </option>
              ))}
            </Select>,
          )}
          {field(
            "level",
            "Level",
            <Select id="level" name="level" defaultValue={c?.level ?? "state"}>
              {["international", "national", "state", "district", "regional"].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </Select>,
          )}
        </div>
        {field("name", "Full name", <Input id="name" name="name" defaultValue={c?.name} required />)}
        {field("shortName", "Short name (used in countdown text)", <Input id="shortName" name="shortName" defaultValue={c?.shortName} required />)}
        <div className="grid gap-4 sm:grid-cols-2">
          {field("state", "State (for state/district dates)", <Input id="state" name="state" defaultValue={c?.state ?? ""} maxLength={5} />)}
          {field(
            "regionId",
            "District / area",
            <Select id="regionId" name="regionId" defaultValue={c?.regionId ?? ""}>
              <option value="">None</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.org.toUpperCase()} {r.state} {r.name}
                </option>
              ))}
            </Select>,
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {field("startsOn", "Starts", <Input id="startsOn" name="startsOn" type="date" defaultValue={c?.startsOn} required />)}
          {field("endsOn", "Ends", <Input id="endsOn" name="endsOn" type="date" defaultValue={c?.endsOn} required />)}
          {field("timezone", "Time zone", <Input id="timezone" name="timezone" defaultValue={c?.timezone ?? "America/Chicago"} required />)}
        </div>
        {field("location", "Location", <Input id="location" name="location" defaultValue={c?.location ?? ""} />)}
        <div className="grid gap-4 sm:grid-cols-2">
          {field(
            "status",
            "Date status",
            <Select id="status" name="status" defaultValue={c?.status ?? "unconfirmed"}>
              <option value="confirmed">Confirmed (official source)</option>
              <option value="tentative">Tentative (published, may change)</option>
              <option value="unconfirmed">Unconfirmed</option>
            </Select>,
          )}
          {field("sourceCheckedAt", "Source last checked", <Input id="sourceCheckedAt" name="sourceCheckedAt" type="date" defaultValue={c?.sourceCheckedAt ?? ""} />)}
        </div>
        {field("sourceUrl", "Official source URL", <Input id="sourceUrl" name="sourceUrl" type="url" defaultValue={c?.sourceUrl ?? ""} />)}
        {field("statusNote", "Note shown to students", <Textarea id="statusNote" name="statusNote" rows={2} defaultValue={c?.statusNote ?? ""} />)}
        {!isNew ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="announce" className="size-4" /> If the dates changed, publish a &ldquo;new date&rdquo; announcement and notify affected students
          </label>
        ) : null}
      </ActionForm>
    </div>
  );
}
