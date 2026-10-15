/**
 * Pure helpers for the course reader: splitting a lesson into pages, marking key terms in
 * lesson markdown, and summarizing unit progress. No I/O, so it is safe on server and client.
 */

export const PAGE_MIN_WORDS = 110;
export const PAGE_MAX_WORDS = 170;
/** A page may run over the maximum by this much rather than leave a short page behind. */
const PAGE_SLACK = 1.25;
export const READ_WPM = 200;
export const MASTERY_MIN_ANSWERS = 15;
export const MASTERY_ACCURACY = 0.8;

const LIST_LINE = /^\s*(- |\d+\. )/;

// Key-term tokens: private-use characters that never appear in lesson text and contain no
// markdown syntax, so a marked source still parses exactly like the original.
export const TERM_START = "\uE000";
export const TERM_MID = "\uE001";
export const TERM_END = "\uE002";
const TERM_TOKEN = /\uE000(\d+)\uE001([^\uE002]*)\uE002/g;

export function stripTermTokens(text: string) {
  return text.replace(TERM_TOKEN, "$2");
}

/** Words of reading text (list markers, emphasis markers and term tokens don't count). */
export function wordCount(md: string) {
  return stripTermTokens(md)
    .replace(/^\s*(- |\d+\. )/gm, " ")
    .replace(/\*/g, "")
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export function readMinutes(words: number, checkQuestions = 0) {
  return Math.max(1, Math.round(words / READ_WPM + checkQuestions * 0.5));
}

/**
 * Estimated minutes for a unit's lesson: objective, body and examples, plus the check questions.
 * Shared by the course overview and the reader so both show the same estimate.
 */
export function lessonMinutes(unit: { objective: string; body: string; examples: readonly string[] }, checkQuestions: number) {
  return readMinutes(wordCount(unit.objective) + wordCount(unit.body) + wordCount(examplesMarkdown(unit.examples)), checkQuestions);
}

/** Sentences of a paragraph. Never splits inside *italic* or **bold** spans. */
export function splitSentences(text: string): string[] {
  const parts = text
    .trim()
    .split(/(?<=[.!?]["'”’)\]]?)\s+(?=["'“‘(*]*[\p{Lu}\p{N}])/u)
    .filter(Boolean);
  const out: string[] = [];
  let buf = "";
  for (const p of parts) {
    buf = buf ? `${buf} ${p}` : p;
    if ((buf.match(/\*/g)?.length ?? 0) % 2 === 0) {
      out.push(buf);
      buf = "";
    }
  }
  if (buf) out.push(buf);
  return out;
}

type Segment = { md: string; words: number; list: boolean };

/** A paragraph as one segment, or split at sentence boundaries into near-equal chunks if it can't fit a page. */
function paragraphSegments(text: string): Segment[] {
  const words = wordCount(text);
  if (words <= PAGE_MAX_WORDS) return [{ md: text, words, list: false }];
  const target = words / Math.ceil(words / PAGE_MAX_WORDS);
  const out: Segment[] = [];
  let cur: string[] = [];
  let n = 0;
  for (const s of splitSentences(text)) {
    cur.push(s);
    n += wordCount(s);
    if (n >= target) {
      out.push({ md: cur.join(" "), words: n, list: false });
      cur = [];
      n = 0;
    }
  }
  if (cur.length) out.push({ md: cur.join(" "), words: n, list: false });
  return out;
}

/**
 * Indivisible pieces of a lesson. A list is always kept with the sentence that introduces it
 * (the lead lines of its own block, or else the last sentence of the paragraph before it).
 * List segments are written as "lead\n- item" so the Markdown component renders them as a
 * paragraph followed by the list, exactly like the original blocks.
 */
export function lessonSegments(source: string): Segment[] {
  const blocks = source
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  const segs: Segment[] = [];
  const attach = (lead: string, list: string) => {
    const lw = wordCount(lead);
    const listWords = wordCount(list);
    if (lw + listWords <= PAGE_MAX_WORDS) {
      segs.push({ md: `${lead}\n${list}`, words: lw + listWords, list: true });
      return;
    }
    const sentences = splitSentences(lead);
    const last = sentences.pop() ?? lead;
    if (sentences.length) segs.push(...paragraphSegments(sentences.join(" ")));
    segs.push({ md: `${last}\n${list}`, words: wordCount(last) + listWords, list: true });
  };
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim());
    const first = lines.findIndex((l) => LIST_LINE.test(l));
    if (first === -1) {
      segs.push(...paragraphSegments(lines.join(" ")));
      continue;
    }
    const head = lines.slice(0, first).join(" ").trim();
    const list = lines.slice(first).join("\n");
    if (head) {
      attach(head, list);
      continue;
    }
    const prev = segs.at(-1);
    if (prev && !prev.list) {
      segs.pop();
      attach(prev.md, list);
    } else {
      segs.push({ md: list, words: wordCount(list), list: true });
    }
  }
  return segs;
}

/** Splits lesson markdown into pages of about 110–170 words, keeping lists with their lead sentence. */
export function paginateLesson(source: string): string[] {
  const pages: Segment[][] = [];
  let cur: Segment[] = [];
  let n = 0;
  for (const s of lessonSegments(source)) {
    const over = n + s.words > PAGE_MAX_WORDS;
    const shortAndFits = n < PAGE_MIN_WORDS && n + s.words <= PAGE_MAX_WORDS * PAGE_SLACK;
    if (cur.length && over && !shortAndFits) {
      pages.push(cur);
      cur = [];
      n = 0;
    }
    cur.push(s);
    n += s.words;
  }
  if (cur.length) pages.push(cur);
  // A short last page: fold it into the page before when that stays readable, otherwise move
  // whole segments back onto it while that evens the two pages out.
  const words = (p: Segment[]) => p.reduce((t, s) => t + s.words, 0);
  const last = pages.at(-1);
  const prev = pages.at(-2);
  if (last && prev && words(last) < PAGE_MIN_WORDS) {
    if (words(last) < PAGE_MIN_WORDS / 2 && words(prev) + words(last) <= PAGE_MAX_WORDS * PAGE_SLACK) {
      pages.splice(pages.length - 2, 2, [...prev, ...last]);
    } else {
      while (prev.length > 1) {
        const moved = prev[prev.length - 1];
        const a = words(prev) - moved.words;
        const b = words(last) + moved.words;
        if (b > PAGE_MAX_WORDS * PAGE_SLACK || Math.min(a, b) <= Math.min(words(prev), words(last))) break;
        last.unshift(prev.pop()!);
      }
    }
  }
  return pages.map((p) => p.map((s) => s.md).join("\n\n"));
}

/** The unit's examples as a markdown list (one item per example). */
export function examplesMarkdown(examples: readonly string[]) {
  return examples
    .map((e) => e.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((e) => `- ${e}`)
    .join("\n");
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Wraps key-term occurrences in tokens the Markdown component renders as term marks.
 * Case-insensitive whole-word matches (a plural "s"/"es" also counts), longest term first,
 * and only the first occurrence of each term in this source. `terms[i]` becomes token i.
 * Matches never contain "*" or line breaks, so emphasis markers and blocks stay intact.
 */
export function markTerms(source: string, terms: readonly string[]) {
  const order = terms
    .map((t, i) => ({ t: t.trim(), i }))
    .filter((x) => x.t.length >= 2 && !/[*\n\uE000-\uE002]/.test(x.t))
    .sort((a, b) => b.t.length - a.t.length || a.i - b.i);
  if (!order.length || !source) return source;
  const alternatives = order.map((x) => `(${x.t.split(/\s+/).map(escapeRe).join("[^\\S\\n]+")}(?:e?s)?)`);
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives.join("|")})(?![\\p{L}\\p{N}])`, "giu");
  const used = new Set<number>();
  return source.replace(re, (match: string, ...groups: unknown[]) => {
    const g = groups.slice(0, order.length).findIndex((x) => x !== undefined);
    const term = order[g]?.i;
    if (term === undefined || used.has(term)) return match;
    used.add(term);
    return `${TERM_START}${term}${TERM_MID}${match}${TERM_END}`;
  });
}

export type TermPiece = string | { term: number; text: string };

/** Splits text into plain strings and marked terms (see markTerms). */
export function splitTermTokens(text: string): TermPiece[] {
  const out: TermPiece[] = [];
  let last = 0;
  for (const m of text.matchAll(TERM_TOKEN)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push({ term: Number(m[1]), text: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length || !out.length) out.push(text.slice(last));
  return out;
}

/** One glossary entry per term (case-insensitive); earlier entries win, so pass the unit's own cards first. */
export function dedupeTerms<T extends { term: string }>(cards: readonly T[]): T[] {
  const seen = new Set<string>();
  return cards.filter((c) => {
    const k = c.term.trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export type UnitProgressInput = { started: boolean; lessonDone: boolean; mastered: boolean; recentAnswered: number; recentAccuracy: number | null };
export type UnitStage = "Not started" | "In progress" | "Done" | "Mastered";

export function unitStage(u: UnitProgressInput): UnitStage {
  if (u.mastered) return "Mastered";
  if (u.lessonDone) return "Done";
  return u.started ? "In progress" : "Not started";
}

/** 0–1 toward mastery: reading the lesson is the first 40%, practice toward 80% on 15+ questions the rest. */
export function unitProgress(u: UnitProgressInput) {
  if (u.mastered) return 1;
  if (!u.lessonDone) return u.started ? 0.15 : 0;
  const volume = Math.min(1, u.recentAnswered / MASTERY_MIN_ANSWERS);
  const accuracy = Math.min(1, (u.recentAccuracy ?? 0) / MASTERY_ACCURACY);
  return Math.min(0.99, 0.4 + 0.6 * volume * accuracy);
}

/** The unit the course hero points at: the first unread lesson, else the first unit not yet mastered. */
export function nextUnit<T extends UnitProgressInput>(units: readonly T[]): { unit: T; verb: "Start" | "Continue" | "Practice" } | null {
  const lesson = units.find((u) => !u.lessonDone);
  if (lesson) return { unit: lesson, verb: units.some((u) => u.started || u.lessonDone) ? "Continue" : "Start" };
  const practice = units.find((u) => !u.mastered);
  return practice ? { unit: practice, verb: "Practice" } : null;
}
