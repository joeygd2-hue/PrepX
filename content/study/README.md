# Study content

All lessons, questions and flashcards here are original PrepX content written for practice. They are aligned to publicly described exam topic areas but are not official competition materials.

Each folder is one study bank, named by its id:

- `<bank>/1.json`, `2.json`, … — units in order (lesson, examples, questions, flashcards). Unit ids are assigned in this order, so append new files rather than renumbering.
- `<bank>/resources.json` — curated external resources (optional).
- `<bank>/meta.json` — only for banks that aren't an organization's official test (`kind` "practice" or "skills"). Official test banks are declared in `content/events/<org>.json`.

Authoring rules are in `docs/CONTENT.md`. `npm test` validates every file.
