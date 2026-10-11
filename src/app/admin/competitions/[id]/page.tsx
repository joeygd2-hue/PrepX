import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { ActionForm } from "@/components/ui/action-form";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import { Accent, BackHeader } from "@/components/ui/page";
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
    <div className="stagger mx-auto max-w-2xl">
      <BackHeader href="/admin/competitions" />
      <header className="mb-7">
        {!isNew ? (
          <p className="eyebrow mb-2">
            {c!.org.toUpperCase()} · {c!.level} · {c!.id}
          </p>
        ) : null}
        <h1 className="text-[1.75rem] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[2rem]">
          {isNew ? (
            <>
              Add competition <Accent>date</Accent>
            </>
          ) : (
            c!.name
          )}
        </h1>
      </header>
      <ActionForm action={saveCompetition} className="space-y-3">
        {isNew ? <input type="hidden" name="isNew" value="1" /> : <input type="hidden" name="id" value={c!.id} />}
        <Card className="space-y-4">
          {isNew ? field("id", "ID (e.g. deca-tx-state-2027)", <Input id="id" name="id" required pattern="[a-z0-9-]{3,60}" className="font-mono" />) : null}
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
        </Card>
        <Card className="space-y-4">
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
            {field("startsOn", "Starts", <Input id="startsOn" name="startsOn" type="date" defaultValue={c?.startsOn} required className="font-mono tabular" />)}
            {field("endsOn", "Ends", <Input id="endsOn" name="endsOn" type="date" defaultValue={c?.endsOn} required className="font-mono tabular" />)}
            {field("timezone", "Time zone", <Input id="timezone" name="timezone" defaultValue={c?.timezone ?? "America/Chicago"} required />)}
          </div>
          {field("location", "Location", <Input id="location" name="location" defaultValue={c?.location ?? ""} />)}
        </Card>
        <Card className="space-y-4">
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
            {field("sourceCheckedAt", "Source last checked", <Input id="sourceCheckedAt" name="sourceCheckedAt" type="date" defaultValue={c?.sourceCheckedAt ?? ""} className="font-mono tabular" />)}
          </div>
          {field("sourceUrl", "Official source URL", <Input id="sourceUrl" name="sourceUrl" type="url" defaultValue={c?.sourceUrl ?? ""} />)}
          {field("statusNote", "Note shown to students", <Textarea id="statusNote" name="statusNote" rows={2} defaultValue={c?.statusNote ?? ""} />)}
          {!isNew ? (
            <label className="flex cursor-pointer items-start gap-3 rounded-[16px] border border-border bg-card p-4 text-sm leading-relaxed transition-[border-color,box-shadow] duration-200 hover:border-border-strong has-[:checked]:border-fg has-[:checked]:ring-4 has-[:checked]:ring-accent/30">
              <input type="checkbox" name="announce" className="mt-px size-5 shrink-0 accent-[var(--fg)]" /> If the dates changed, publish a &ldquo;new date&rdquo; announcement and notify affected students
            </label>
          ) : null}
        </Card>
      </ActionForm>
    </div>
  );
}
