import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Validates every study bank in content/study against docs/CONTENT.md. */
const ROOT = join(__dirname, "../../content");
const read = (p: string) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

type Q = { stem: string; choices: string[]; answer: number; explanation: string };
type Unit = { title: string; objective: string; body: string; examples: string[]; questions: Q[]; flashcards: { term: string; definition: string }[] };

const ORGS = ["deca", "fbla", "hosa", "tsa"] as const;
const orgFiles = ORGS.map((o) => read(`events/${o}.json`) as { clusters: { id: string }[]; events: { code: string; components: Record<string, { clusterId?: string } | undefined> }[] });
const examBanks = new Set(orgFiles.flatMap((f) => f.clusters.map((c) => c.id)));
const bankDirs = readdirSync(join(ROOT, "study"), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);
const metaBanks = new Map(bankDirs.filter((b) => existsSync(join(ROOT, "study", b, "meta.json"))).map((b) => [b, read(`study/${b}/meta.json`)]));
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

describe("study content", () => {
  it("every bank folder is declared by an events file or a meta.json, never both", () => {
    for (const b of bankDirs) {
      expect(examBanks.has(b) || metaBanks.has(b), `${b} is not declared`).toBe(true);
      expect(examBanks.has(b) && metaBanks.has(b), `${b} is declared twice`).toBe(false);
    }
    for (const [b, m] of metaBanks) {
      expect(["practice", "skills"], `${b} kind`).toContain(m.kind);
      expect(m.org === null || ORGS.includes(m.org), `${b} org`).toBe(true);
      expect(m.kind === "skills" ? m.org === null : m.org !== null, `${b}: skills banks are cross-organization, practice banks belong to one`).toBe(true);
      expect(typeof m.code === "string" && m.code.length > 0 && typeof m.name === "string" && m.name.length > 0, `${b} code/name`).toBe(true);
    }
  });

  it("every event's test or knowledge bank exists", () => {
    const known = new Set([...examBanks, ...metaBanks.keys()]);
    for (const f of orgFiles)
      for (const e of f.events) {
        const ids = [e.components.exam?.clusterId, e.components.knowledge?.clusterId].filter(Boolean) as string[];
        for (const id of ids) expect(known.has(id), `${e.code} → ${id}`).toBe(true);
        expect(Boolean(e.components.exam && e.components.knowledge), `${e.code} has both a test and a knowledge bank`).toBe(false);
      }
  });

  for (const bank of bankDirs) {
    const dir = join(ROOT, "study", bank);
    const files = readdirSync(dir).filter((f) => /^\d+\.json$/.test(f));
    if (!files.length && !existsSync(join(dir, "resources.json"))) continue;
    const kind = metaBanks.get(bank)?.kind ?? "exam";

    it(`${bank}: unit files, lessons, questions and flashcards are well formed`, () => {
      const nums = files.map((f) => parseInt(f)).sort((a, b) => a - b);
      expect(nums, `${bank} files must be numbered 1..n`).toEqual(nums.map((_, i) => i + 1));
      const stems = new Set<string>();
      const terms = new Set<string>();
      for (const n of nums) {
        const units = read(`study/${bank}/${n}.json`) as Unit[];
        expect(Array.isArray(units) && units.length > 0, `${bank}/${n}.json must be a non-empty array`).toBe(true);
        for (const u of units) {
          const where = `${bank}/${n}.json "${u.title}"`;
          expect(u.title?.trim().length, `${where} title`).toBeGreaterThan(0);
          expect(u.title.length, `${where} title length`).toBeLessThanOrEqual(80);
          expect(u.objective?.trim().length, `${where} objective`).toBeGreaterThan(0);
          expect(words(u.body), `${where} lesson length (words)`).toBeGreaterThanOrEqual(120);
          expect(words(u.body), `${where} lesson length (words)`).toBeLessThanOrEqual(700);
          expect(/^#|<[a-z/]|```|\[[^\]]+\]\(/im.test(u.body), `${where} lesson uses unsupported formatting (headings, HTML, code or links)`).toBe(false);
          expect(Array.isArray(u.examples) && u.examples.length >= 1, `${where} examples`).toBe(true);
          expect(u.questions.length, `${where} question count`).toBeGreaterThanOrEqual(kind === "skills" ? 3 : 5);
          for (const q of u.questions) {
            const at = `${where} → "${q.stem?.slice(0, 60)}"`;
            expect(q.stem?.trim().length, `${at} stem`).toBeGreaterThan(0);
            expect(q.stem.length, `${at} stem length`).toBeLessThanOrEqual(500);
            expect(q.choices, `${at} must have 4 choices`).toHaveLength(4);
            expect(new Set(q.choices.map(norm)).size, `${at} choices must be distinct`).toBe(4);
            for (const c of q.choices) {
              expect(c.trim().length, `${at} empty choice`).toBeGreaterThan(0);
              expect(c.length, `${at} choice too long`).toBeLessThanOrEqual(200);
              expect(/^(all|none|both) of the above$|^(both|neither) [a-d] (and|nor) [a-d]$/i.test(c.trim()), `${at} uses an "of the above" choice`).toBe(false);
            }
            expect(Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3, `${at} answer index`).toBe(true);
            expect(q.explanation?.trim().length, `${at} explanation`).toBeGreaterThanOrEqual(12);
            expect(stems.has(norm(q.stem)), `${at} duplicate stem in ${bank}`).toBe(false);
            stems.add(norm(q.stem));
          }
          expect(u.flashcards.length, `${where} flashcards`).toBeGreaterThanOrEqual(3);
          for (const f of u.flashcards) {
            expect(f.term?.trim().length && f.definition?.trim().length, `${where} flashcard "${f.term}"`).toBeTruthy();
            expect(f.term.length, `${where} flashcard term "${f.term}" too long`).toBeLessThanOrEqual(80);
            expect(terms.has(norm(f.term)), `${where} duplicate flashcard term "${f.term}"`).toBe(false);
            terms.add(norm(f.term));
          }
        }
      }
    });

    if (existsSync(join(dir, "resources.json")))
      it(`${bank}: resources are well formed`, () => {
        const res = read(`study/${bank}/resources.json`) as { title: string; url: string; publisher: string; kind: string; note?: string }[];
        expect(Array.isArray(res), `${bank} resources must be an array`).toBe(true);
        expect(res.length, `${bank} resource count`).toBeLessThanOrEqual(8);
        const urls = new Set<string>();
        for (const r of res) {
          expect(r.title?.trim().length && r.publisher?.trim().length, `${bank} resource title/publisher`).toBeTruthy();
          expect(["official", "textbook", "course", "reference", "video", "tool"], `${bank} resource kind ${r.kind}`).toContain(r.kind);
          const u = new URL(r.url);
          expect(u.protocol, `${bank} ${r.url} must be https`).toBe("https:");
          expect(urls.has(r.url), `${bank} duplicate ${r.url}`).toBe(false);
          urls.add(r.url);
          expect((r.note ?? "").length, `${bank} note too long`).toBeLessThanOrEqual(200);
        }
      });
  }
});
