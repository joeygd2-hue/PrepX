# PrepX — Writing study content

All study content is **original PrepX material** written for practice. It is aligned to the topic areas each organization publicly describes for its events, but it is never copied from official tests, sample exams, guides, textbooks or other sites. Competition tests (DECA/MBA Research exams, FBLA objective tests, HOSA tests, TSA tests) are copyrighted; never reproduce, paraphrase closely or "reconstruct" their questions. External material appears only as links in `resources.json`.

## Where content lives

`content/study/<bank-id>/` — one folder per study bank:

| File | Purpose |
|---|---|
| `1.json`, `2.json`, … | Units in order. Each file is a JSON array of units. Unit ids are assigned in order across files, so add new files at the end; never renumber or reorder existing ones. |
| `resources.json` | Curated external resources for the bank (optional). |
| `meta.json` | Only for banks that aren't an organization's official test (`"kind": "practice"` or `"skills"`). Official test banks are declared in `content/events/<org>.json` (`clusters`). |

Bank kinds:

- **exam** — an organization's official test topic (e.g. `deca-mkt`, `hosa-pharm`, `fbla-accounting`). Questions mirror the knowledge areas that test covers.
- **practice** — the knowledge behind events without an official test (e.g. `tsa-architecture`, `fbla-programming`, `deca-pm`). Events point to it with `components.knowledge` in the events files.
- **skills** — how to compete in a format (role-plays, case studies, presentations, written entries, interviews, projects, test-taking). Shared by every organization; shown on any event with that component.

## Unit format

```json
{
  "title": "Pricing strategies",
  "objective": "Choose and justify a pricing strategy for a product launch.",
  "body": "Lesson text (see Writing the lesson).",
  "examples": ["One concrete worked example or scenario.", "Another."],
  "questions": [
    {
      "stem": "A brand-new phone is priced high at launch, then lowered as competitors arrive. Which strategy is this?",
      "choices": ["Penetration pricing", "Price skimming", "Cost-plus pricing", "Bundle pricing"],
      "answer": 1,
      "explanation": "Price skimming starts high to capture early adopters, then lowers price over time. Penetration pricing starts low to win share quickly."
    }
  ],
  "flashcards": [{ "term": "Price skimming", "definition": "Launching at a high price, then lowering it over time to reach more price-sensitive buyers." }]
}
```

Sizes:

| Bank kind | Units | Questions per unit | Flashcards per unit |
|---|---|---|---|
| DECA exam banks | 5 | 10 | 6 |
| Other exam and practice banks | 3 | 8 | 5 |
| Skills banks | 3 | 4 | 5 |

## Writing the lesson

- `body` is 250–450 words of plain teaching, written for a high-school competitor. Supported formatting only: blank-line-separated paragraphs, `**bold**`, `*italic*`, lists with `- ` or `1. ` (a list may follow a paragraph line directly). No headings, links, tables, HTML or code fences.
- Start with why the topic matters on competition day, teach the 3–5 ideas that tests and judges actually reward, and end with a common mistake to avoid.
- `examples` are 2–3 short, concrete scenarios (numbers where useful).

## Writing questions

- Exactly **4 choices**, exactly **one** unambiguously correct answer, `answer` is the 0-based index of it. The seed shuffles choice order, so put the correct answer anywhere.
- Distractors are plausible and the same length/style as the answer. No "all of the above", "none of the above", "both A and B", joke answers or trick wording.
- Test understanding and application (scenarios, calculations, "which is the best next step"), not trivia about the organizations themselves, unless the bank is about the organization (e.g. Introduction to FBLA).
- Every number in a calculation question must work out exactly; show the arithmetic in the explanation.
- `explanation` (1–3 sentences, at least 12 characters) says why the answer is right and, when useful, why the most tempting distractor is wrong.
- No duplicate or near-duplicate stems within a bank. Stems are ≤ 400 characters; choices ≤ 160.
- Facts must be accurate and current as of 2026, and stable: avoid figures that change yearly (tax brackets, contribution limits, interest rates) unless the question supplies them. Health content follows mainstream, current clinical guidance; never give individual medical advice.
- Neutral, inclusive, age-appropriate scenarios; no real living private people, no brands in a negative light.

## Flashcards

`term` (≤ 60 characters) and `definition` (one sentence, ≤ 200 characters). Terms are unique within a bank.

## resources.json

```json
[
  { "title": "Principles of Marketing", "url": "https://openstax.org/details/books/principles-marketing", "publisher": "OpenStax", "kind": "textbook", "note": "Free, openly licensed textbook. Chapters 1–3 cover the marketing mix." }
]
```

- 3–4 resources per bank (the Study page already links each organization's official competitive-events page), `kind` one of `official`, `textbook`, `course`, `reference`, `video`, `tool`.
- Only free resources that need no account: the organization's own pages, government and public-agency sites (.gov, NIH/MedlinePlus, CDC, CFPB, Investor.gov, SBA, BLS), OpenStax, Khan Academy, CK-12, MIT OpenCourseWare, university writing labs (e.g. Purdue OWL), and similar reputable non-commercial sources.
- **Every URL must be one you saw returned by a web search** in this session (copy it exactly; no guessed or reconstructed URLs). Prefer stable landing pages over deep links.
- `note` (≤ 160 characters) says what to use it for.

## Checks

`npm run test:content` (also part of `npm test`) runs `tests/unit/content.test.ts`, which validates every bank: file numbering, unit and question shape, 4 distinct choices, answer index, unique stems and terms, lesson formatting, resource URLs, and that every event's test or knowledge bank exists. Run it before committing content.
