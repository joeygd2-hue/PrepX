/**
 * Idempotent seed: loads /content JSON into the database. Safe to re-run after editing
 * content files; rows are upserted by stable ids (question/flashcard ids are derived from
 * a hash of their text so re-seeding does not duplicate them or break attempt history).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { db, schema } from "./index";

const read = <T>(p: string): T => JSON.parse(readFileSync(new URL(`../../content/${p}`, import.meta.url), "utf8"));

function stableUuid(input: string) {
  const h = createHash("sha1").update(input).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Deterministic shuffle so correct answers are spread across A–D. */
function shuffleChoices(choices: string[], answer: number, seed: string) {
  const order = choices.map((_, i) => i);
  let s = parseInt(createHash("md5").update(seed).digest("hex").slice(0, 8), 16);
  for (let i = order.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { choices: order.map((i) => choices[i]), answer: order.indexOf(answer) };
}

type OrgFile = {
  org: "deca" | "fbla" | "hosa" | "tsa";
  sourceUrl: string;
  season: string;
  clusters: { id: string; code: string; name: string; questionCount: number | null; minutes: number | null; verification: "verified" | "reference_observed" | "unverified" }[];
  events: {
    code: string; name: string; category: string; formatLabel: string; cluster?: string; team?: string;
    components: schema.EventComponentsT; rubric: schema.RubricCriterionT[]; verification: "verified" | "reference_observed" | "unverified"; position: number;
  }[];
};

async function seedCatalog() {
  for (const org of ["deca", "fbla", "hosa", "tsa"] as const) {
    const f = read<OrgFile>(`events/${org}.json`);
    for (const c of f.clusters) {
      await db.insert(schema.examClusters).values({ ...c, org }).onConflictDoUpdate({
        target: schema.examClusters.id,
        set: { code: c.code, name: c.name, questionCount: c.questionCount, minutes: c.minutes, verification: c.verification },
      });
    }
    for (const e of f.events) {
      const row = {
        id: `${org}-${e.code.toLowerCase()}`,
        org,
        code: e.code,
        name: e.name,
        category: e.category,
        cluster: e.cluster ?? null,
        formatLabel: e.formatLabel,
        team: e.team ?? "individual",
        components: e.components,
        rubric: e.rubric,
        rubricVerification: "unverified" as const,
        levels: [],
        verification: e.verification,
        sourceUrl: f.sourceUrl,
        season: f.season,
        position: e.position,
      };
      await db.insert(schema.events).values(row).onConflictDoUpdate({ target: schema.events.id, set: { ...row, updatedAt: new Date() } });
    }
    log(`  ${org}: ${f.events.length} events, ${f.clusters.length} exam clusters`);
  }
}

async function seedDates() {
  const f = read<{
    regions: { id: string; org: "deca"; state: string; name: string; description?: string }[];
    competitions: (typeof schema.competitions.$inferInsert)[];
    announcements: { org: "deca"; competitionId: string; kind: string; title: string; body: string; sourceUrl: string }[];
  }>("competitions.json");
  for (const [i, r] of f.regions.entries()) {
    await db.insert(schema.regions).values({ ...r, position: i }).onConflictDoUpdate({ target: schema.regions.id, set: { name: r.name, description: r.description ?? null, position: i } });
  }
  for (const c of f.competitions) {
    await db.insert(schema.competitions).values(c).onConflictDoNothing();
  }
  for (const a of f.announcements) {
    const exists = await db.select({ id: schema.announcements.id }).from(schema.announcements).where(sql`${schema.announcements.title} = ${a.title}`);
    if (!exists.length) await db.insert(schema.announcements).values(a);
  }
  log(`  ${f.competitions.length} competitions, ${f.regions.length} regions, ${f.announcements.length} announcements`);
}

type Unit = {
  title: string; objective: string; body: string; examples: string[];
  questions: { stem: string; choices: string[]; answer: number; explanation: string }[];
  flashcards: { term: string; definition: string }[];
};

async function seedStudy() {
  const idx = read<{ banks: { clusterId: string; files: string[] }[] }>("study/index.json");
  for (const bank of idx.banks) {
    const units = bank.files.flatMap((file) => read<Unit[]>(`study/${file}`));
    let q = 0;
    for (const [i, u] of units.entries()) {
      const unitId = `${bank.clusterId}-u${i + 1}`;
      const unitRow = { id: unitId, clusterId: bank.clusterId, position: i + 1, title: u.title, objective: u.objective, body: u.body, examples: u.examples };
      await db.insert(schema.units).values(unitRow).onConflictDoUpdate({ target: schema.units.id, set: unitRow });
      for (const qu of u.questions) {
        const id = stableUuid(`${bank.clusterId}|${qu.stem}`);
        const { choices, answer } = shuffleChoices(qu.choices, qu.answer, id);
        const row = { id, clusterId: bank.clusterId, unitId, stem: qu.stem, choices, answerIndex: answer, explanation: qu.explanation, source: "prepx_original" as const };
        await db.insert(schema.questions).values(row).onConflictDoUpdate({ target: schema.questions.id, set: row });
        q++;
      }
      for (const fc of u.flashcards) {
        const row = { id: stableUuid(`${bank.clusterId}|card|${fc.term}`), clusterId: bank.clusterId, unitId, term: fc.term, definition: fc.definition };
        await db.insert(schema.flashcards).values(row).onConflictDoUpdate({ target: schema.flashcards.id, set: row });
      }
    }
    log(`  ${bank.clusterId}: ${units.length} units, ${q} questions`);
  }
}

async function seedPlans() {
  const f = read<{ limits: (typeof schema.planLimits.$inferInsert)[] }>("plans.json");
  for (const l of f.limits) await db.insert(schema.planLimits).values(l).onConflictDoNothing();
  log(`  ${f.limits.length} plan limits`);
}

let log: (m: string) => void = () => {};

export async function seedAll(logger: (m: string) => void = () => {}) {
  log = logger;
  await seedCatalog();
  await seedDates();
  await seedStudy();
  await seedPlans();
}
