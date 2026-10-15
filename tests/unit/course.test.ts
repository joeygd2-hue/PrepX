import { describe, expect, it } from "vitest";
import {
  PAGE_MAX_WORDS,
  dedupeTerms,
  examplesMarkdown,
  lessonMinutes,
  lessonSegments,
  markTerms,
  nextUnit,
  paginateLesson,
  readMinutes,
  splitSentences,
  splitTermTokens,
  stripTermTokens,
  unitProgress,
  unitStage,
  wordCount,
} from "@/lib/course";

const words = (n: number, seed = "word") => Array.from({ length: n }, (_, i) => `${seed}${i}`).join(" ");
const sentence = (n: number, seed = "word") => `${words(n - 1, seed)} end.`.replace(/^./, (c) => c.toUpperCase());
const bold = /\*\*[^*]+\*\*/g;

describe("wordCount and readMinutes", () => {
  it("ignores list and emphasis markers", () => {
    expect(wordCount("**Bold** and *italic* text.\n- one item\n1. two items")).toBe(8);
  });
  it("rounds to at least one minute", () => {
    expect(readMinutes(10)).toBe(1);
    expect(readMinutes(600)).toBe(3);
    expect(readMinutes(600, 2)).toBe(4);
  });
  it("estimates a unit's lesson from its objective, body and examples plus checks", () => {
    const unit = { objective: words(50), body: words(250), examples: [words(50), words(50)] };
    expect(lessonMinutes(unit, 0)).toBe(2);
    expect(lessonMinutes(unit, 3)).toBe(4);
    expect(lessonMinutes({ objective: "", body: "", examples: [] }, 0)).toBe(1);
  });
});

describe("splitSentences", () => {
  it("splits at sentence ends but not inside bold lead-ins", () => {
    expect(splitSentences("**Contracts.** A contract is binding. It needs an *offer*. Then acceptance.")).toEqual([
      "**Contracts.** A contract is binding.",
      "It needs an *offer*.",
      "Then acceptance.",
    ]);
  });
  it("keeps an emphasis span together", () => {
    expect(splitSentences("Read *this. And this* now. Done.")).toEqual(["Read *this. And this* now.", "Done."]);
  });
});

describe("paginateLesson", () => {
  it("returns no pages for an empty body", () => {
    expect(paginateLesson("")).toEqual([]);
  });

  it("keeps short lessons on one page and packs paragraphs into ~110–170 word pages", () => {
    expect(paginateLesson(`${sentence(40)}\n\n${sentence(40)}`)).toHaveLength(1);
    const body = Array.from({ length: 6 }, (_, i) => sentence(70, `p${i}w`)).join("\n\n");
    const pages = paginateLesson(body);
    expect(pages).toHaveLength(3);
    for (const p of pages) {
      expect(wordCount(p)).toBeGreaterThanOrEqual(110);
      expect(wordCount(p)).toBeLessThanOrEqual(PAGE_MAX_WORDS);
    }
    // Nothing is lost or reordered.
    expect(pages.join("\n\n")).toBe(body);
  });

  it("evens out a short last page by moving whole paragraphs onto it", () => {
    const body = [20, 70, 60, 40, 20].map((n, i) => sentence(n, `q${i}w`)).join("\n\n");
    const pages = paginateLesson(body);
    expect(pages).toHaveLength(2);
    expect(pages.map(wordCount)).toEqual([90, 120]);
    expect(pages.join("\n\n")).toBe(body);
  });

  it("splits an over-long paragraph at sentence boundaries", () => {
    const para = Array.from({ length: 12 }, (_, i) => sentence(25, `s${i}w`)).join(" ");
    const pages = paginateLesson(para);
    expect(pages.length).toBeGreaterThan(1);
    for (const p of pages) expect(p.trim()).toMatch(/end\.$/);
    expect(pages.join(" ")).toBe(para);
  });

  it("never separates a list from the sentence that introduces it", () => {
    const lead = "Remember these three steps:";
    const body = `${sentence(80, "a")}\n\n${sentence(70, "b")} ${lead}\n\n- Offer\n- Acceptance\n- Consideration\n\n${sentence(60, "c")}`;
    const pages = paginateLesson(body);
    const withList = pages.find((p) => p.includes("- Offer"));
    expect(withList).toBeDefined();
    expect(withList).toContain(`${lead}\n- Offer\n- Acceptance\n- Consideration`);
  });

  it("splits a long lead paragraph so only its last sentence travels with the list", () => {
    const lead = "Use this checklist:";
    const intro = Array.from({ length: 7 }, (_, i) => sentence(24, `l${i}w`)).join(" ");
    const segs = lessonSegments(`${intro} ${lead}\n1. First\n2. Second`);
    expect(segs).toHaveLength(2);
    expect(segs[0].md).toBe(intro);
    const last = segs[segs.length - 1];
    expect(last.md).toBe(`${lead}\n1. First\n2. Second`);
    expect(last.list).toBe(true);
  });

  it("keeps a block's own lead lines with its list", () => {
    const segs = lessonSegments("Three forms:\n- Sole proprietorship\n- Partnership\n- Corporation");
    expect(segs).toHaveLength(1);
    expect(segs[0].md).toBe("Three forms:\n- Sole proprietorship\n- Partnership\n- Corporation");
  });
});

describe("markTerms", () => {
  const unmark = (s: string) => splitTermTokens(s).map((p) => (typeof p === "string" ? p : `[${p.term}:${p.text}]`)).join("");

  it("matches whole words case-insensitively, first occurrence only", () => {
    const out = markTerms("A Contract is a contract. Contractor is not a match.", ["contract"]);
    expect(unmark(out)).toBe("A [0:Contract] is a contract. Contractor is not a match.");
  });

  it("allows a plural ending but not a longer word", () => {
    expect(unmark(markTerms("Two contracts signed.", ["contract"]))).toBe("Two [0:contracts] signed.");
    expect(unmark(markTerms("Contractual terms.", ["contract"]))).toBe("Contractual terms.");
  });

  it("prefers the longest term and marks each term at most once", () => {
    const terms = ["liability", "limited liability"];
    const out = markTerms("Limited liability protects owners. Limited liability again. Unlimited liability means risk. Liability.", terms);
    expect(unmark(out)).toBe("[1:Limited liability] protects owners. Limited liability again. Unlimited [0:liability] means risk. Liability.");
  });

  it("does not match across lines or blocks", () => {
    expect(unmark(markTerms("market\nresearch and market\n\nresearch", ["market research"]))).toBe("market\nresearch and market\n\nresearch");
  });

  it("keeps **bold** and *italic* markers intact", () => {
    const src = "**Contracts.** A *contract* needs *consideration* and **offer and acceptance**.";
    const out = markTerms(src, ["contract", "consideration", "offer and acceptance", "acceptance"]);
    expect(stripTermTokens(out)).toBe(src);
    expect(out.match(bold)?.map(stripTermTokens)).toEqual(src.match(bold));
    expect(unmark(out)).toBe("**[0:Contracts].** A *contract* needs *[1:consideration]* and **[2:offer and acceptance]**.");
  });

  it("never matches a term that spans an emphasis marker", () => {
    const src = "An *offer* and acceptance.";
    expect(stripTermTokens(markTerms(src, ["offer and acceptance"]))).toBe(src);
    expect(markTerms(src, ["offer and acceptance"])).toBe(src);
  });

  it("escapes regex characters and ignores unusable terms", () => {
    expect(unmark(markTerms("Learn C++ (fast) and the 4 Ps.", ["C++", "4 Ps", "*", ""]))).toBe("Learn [0:C++] (fast) and the [1:4 Ps].");
  });

  it("handles sources without matches and term-free tokens", () => {
    expect(markTerms("Nothing here.", ["absent"])).toBe("Nothing here.");
    expect(splitTermTokens("plain")).toEqual(["plain"]);
    expect(splitTermTokens("")).toEqual([""]);
  });
});

describe("helpers", () => {
  it("formats examples as a markdown list", () => {
    expect(examplesMarkdown(["One\nline", "  ", "Two"])).toBe("- One line\n- Two");
  });

  it("dedupes glossary terms case-insensitively, first wins", () => {
    expect(dedupeTerms([{ term: "ROI", d: 1 }, { term: "roi", d: 2 }, { term: "Margin", d: 3 }])).toEqual([
      { term: "ROI", d: 1 },
      { term: "Margin", d: 3 },
    ]);
  });

  it("derives stage and progress toward mastery", () => {
    const base = { started: false, lessonDone: false, mastered: false, recentAnswered: 0, recentAccuracy: null };
    expect(unitStage(base)).toBe("Not started");
    expect(unitStage({ ...base, started: true })).toBe("In progress");
    expect(unitStage({ ...base, started: true, lessonDone: true })).toBe("Done");
    expect(unitStage({ ...base, mastered: true })).toBe("Mastered");
    expect(unitProgress(base)).toBe(0);
    expect(unitProgress({ ...base, lessonDone: true })).toBeCloseTo(0.4);
    expect(unitProgress({ ...base, lessonDone: true, recentAnswered: 15, recentAccuracy: 0.7 })).toBeLessThan(1);
    expect(unitProgress({ ...base, mastered: true })).toBe(1);
  });

  it("picks the next unit and the hero verb", () => {
    const u = (o: Partial<{ started: boolean; lessonDone: boolean; mastered: boolean }>) => ({ started: false, lessonDone: false, mastered: false, recentAnswered: 0, recentAccuracy: null, ...o });
    expect(nextUnit([u({}), u({})])?.verb).toBe("Start");
    const a = [u({ started: true, lessonDone: true }), u({})];
    expect(nextUnit(a)).toEqual({ unit: a[1], verb: "Continue" });
    const b = [u({ lessonDone: true, mastered: true }), u({ lessonDone: true })];
    expect(nextUnit(b)).toEqual({ unit: b[1], verb: "Practice" });
    expect(nextUnit([u({ lessonDone: true, mastered: true })])).toBeNull();
  });
});
