# PrepX

All-in-one competition prep for **DECA, FBLA, HOSA and TSA** high school students: pick your event, follow a smart study plan with a live countdown, practice with exams, lessons, flashcards and an AI coach and judge, and keep up with your chapter's check-ins, announcements and quiz nights.

> PrepX is an independent study tool, not affiliated with or endorsed by DECA, FBLA, HOSA, TSA or any other organization. Practice questions are original PrepX content; AI scores are simulated practice feedback.

- **Reference audit:** [docs/AUDIT.md](docs/AUDIT.md) — what was observed in the reference app and what couldn't be verified
- **Architecture:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — sitemap, flows, data model, auth, AI, billing, tests
- **Deployment:** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — hosting, OAuth, AI, Stripe, email, cron, legal checklist
- **Feature checklist:** [docs/CHECKLIST.md](docs/CHECKLIST.md) — implemented / partial / blocked, per feature
- **Design system:** [docs/DESIGN.md](docs/DESIGN.md) — tokens, primitives, patterns and motion

## Stack

Next.js 16 (App Router, Server Actions) · React 19 · TypeScript · Tailwind CSS v4 · PostgreSQL + Drizzle ORM · Anthropic Claude (server-side) · Stripe · Resend · Vitest · Playwright.

## Local development

Requirements: Node.js 20.9+, PostgreSQL 14+.

```bash
npm install
cp .env.example .env            # defaults work locally: console email, AI "none"
# create a database (example)
createuser -s prepx; createdb -O prepx prepx   # password "prepx" per .env.example, or edit DATABASE_URL
npm run db:setup                # migrate + seed content
npm run dev                     # http://localhost:3000
```

Signing in locally: choose **Continue with email**. With `EMAIL_PROVIDER=console` the 6-digit code is printed in the server log (and stored in the `email_log` table). Add your email to `ADMIN_EMAILS` to get the admin console at `/admin`.

AI locally: set `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` for real feedback, or `AI_PROVIDER=mock` for deterministic test responses (clearly labeled, refused in production).

### Useful scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` / `lint` | TypeScript and ESLint |
| `npm run db:generate` | Create a migration after editing `src/db/schema.ts` |
| `npm run db:migrate` / `db:seed` / `db:setup` | Apply migrations / load `content/` / both |
| `npm test` | Unit + integration tests (needs Postgres; uses database `prepx_test`, recreated each run) |
| `npm run test:e2e` | Playwright end-to-end tests (uses database `prepx_e2e` and its own dev server on port 3100) |

Test databases: `createdb -O prepx prepx_test && createdb -O prepx prepx_e2e`. Override with `TEST_DATABASE_URL` / `E2E_DATABASE_URL`. For Playwright, set `PLAYWRIGHT_CHROMIUM_PATH` if you use a preinstalled Chromium.

## Content

Season content lives in `content/` and is loaded by `npm run db:seed`:

- `content/events/{deca,fbla,hosa,tsa}.json` — event catalog with formats, practice criteria and a verification status per event
- `content/competitions.json` — competition dates with status (confirmed/tentative/unconfirmed) and sources, plus regions
- `content/study/<bank>/*.json` — original lessons, practice questions and flashcards for every DECA, FBLA, HOSA and TSA study bank plus the cross-organization format (skills) banks: 122 banks, 385 lessons, 3,000+ questions, fact-checked October 2026
- `content/plans.json` — Free/Pro allowances

Admins can also edit events, dates, announcements, limits and review AI-generated questions in `/admin`.

## Project layout

```
src/app/(public)     sign-in, legal, public events, trophies, family consent
src/app/(focus)      onboarding, join, exam runner (no bottom nav)
src/app/(app)        Home, Study, Calendar, Chapter, Profile and sub-pages
src/app/admin        staff/admin console
src/app/actions      server actions (all authorize on the server)
src/app/api          auth callbacks, calendar export, Stripe, cron, quiz polling, share cards, data export
src/server           data access and domain services (server-only)
src/lib              pure, framework-free logic (plan, dates, levels, ICS…)
src/components       design system and app components
content/             seasonal data;  drizzle/  SQL migrations;  tests/  unit, integration, e2e
```
