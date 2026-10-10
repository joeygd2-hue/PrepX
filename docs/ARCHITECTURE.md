# PrepX — Architecture

This document covers Phase 2 of the build: sitemap, user flows, components, data model, API surface, auth model, AI integration, billing model and testing strategy. See [AUDIT.md](AUDIT.md) for the reference audit and [DEPLOYMENT.md](DEPLOYMENT.md) for operations.

## 1. Stack and why

| Layer | Choice | Reason |
|---|---|---|
| App | Next.js 16 (App Router, React 19, Server Components + Server Actions), TypeScript | One deployable unit; server-rendered pages keep personal data and secrets on the server. |
| Styling | Tailwind CSS v4 with CSS-variable tokens (`src/app/globals.css`), see [DESIGN.md](DESIGN.md) | "Graphite & Volt" design system: warm neutrals, one accent, light/dark, unlockable accent colors, page-entrance motion. |
| Data | PostgreSQL + Drizzle ORM, SQL migrations in `drizzle/` | Any managed Postgres works (Neon, Supabase, RDS…). No vendor lock-in. |
| Auth | Own implementation: passwordless email codes + Google OAuth (`arctic`), DB-backed sessions | Matches the reference sign-in ("Continue with Google / email"); avoids password storage. |
| AI | Anthropic Claude via `@anthropic-ai/sdk`, server-side only, behind `src/server/ai/provider.ts` | Swap-able provider boundary, structured outputs validated with Zod. |
| Payments | Stripe Checkout, Billing Portal, signed webhooks | Only active when keys are configured. |
| Email | Resend HTTP API (or console provider in development) | Sign-in codes, parent invites, reminders. |
| PWA | `app/manifest.ts`, `public/sw.js`, offline page, Web Push (VAPID, optional) | Installable; caches only static assets. |

Supabase was the suggested default. Plain Postgres + our own auth was chosen because the reference's sign-in is passwordless (email code) and because every authorization rule is enforced in one server data-access layer that is easy to unit-test, instead of being split between row-level-security policies and app code. Row-level security can be layered on later as defense in depth (see §6).

## 2. Sitemap

```
Public
  /sign-in                    landing + "Get started" (Google / email)
  /sign-in/email              email → 6-digit code
  /sign-in/too-young          under-13 refusal
  /events, /events/[id]       public catalog + event details
  /pricing  /advisors  /privacy  /terms  /accessibility
  /trophies/[publicId]        public trophy case (name hidden by default)
  /family/confirm, /family/stop   parent consent / opt-out (no account)
  /offline                    PWA offline fallback

Onboarding (focus layout, no nav)
  /welcome → /onboarding (birthday/13+ → name → school → organizations → terms)

App (bottom nav: Home · Study · Calendar · Chapter · Profile)
  /                           Home dashboard
  /study                      Your event, plan, readiness, today's plan, tools
    /study/events[?federation=]  chooser   /study/events/[id] details
    /study/target             competition date / custom date
    /study/learn?exam=, /study/learn/[unitId]       lessons
    /study/practice?exam=&mode=   start screen → /study/attempt/[id] (focus) → /review
    /study/flashcards  /study/explain  /study/history
    /study/coach  /study/judge  /study/judge/[id]  /study/judge-questions  /study/check?type=
  /calendar, /calendar/region
  /chapter, /join (focus), /chapter/new, /chapter/[id]/manage, /chapter/quiz, /chapter/quiz/[id]
  /profile, /profile/plan, /profile/feedback, /profile/ambassador, /profile/delete
  /buddies  /goals  /invite  /share  /leaderboard  /notifications  /announcements/[id]

Admin (staff/admin role)
  /admin, /admin/competitions[/id|new], /admin/announcements, /admin/events[/id],
  /admin/questions, /admin/chapters, /admin/feedback, /admin/limits, /admin/users, /admin/health
```

## 3. Key user flows

1. **Sign up** — `/sign-in` → email → code emailed (hash stored, 10-min TTL, 5 attempts enforced atomically) → session cookie → `/welcome` → onboarding (resumable; `profiles.onboarding_step`; the age check is the first step) → `/study/events`.
   Under 13 → account and inputs deleted immediately → `/sign-in/too-young` (the browser can't retry with another date for 24 h). "Cancel sign-up" deletes the account at any step; unfinished sign-ups are deleted after 7 days.
2. **Choose event** — org switcher → chooser (search + categories) → details (verification status, practice rubric, official source) → "Study this event" (previous selection kept inactive for history).
3. **Daily study** — Home/Study show countdown (computed per request in the viewer's time zone), milestones and today's 2–4 tasks. Tasks auto-complete when the server records the matching activity; manual ticks are self-tracking only and earn no XP.
4. **Practice exam** — start screen (POST; never on prefetch) → attempt runner → server grading → review with topic breakdown and comparison to last attempt → misses go to the mistake notebook until answered correctly twice.
5. **AI judge** — scenario generated (allowance reserved → committed on delivery) → prep timer → perform (voice-to-text in browser or typing; optional camera stills) → scoring against the event's practice criteria (re-try is free if scoring fails) → feedback + coach debrief.
6. **Chapter** — advisor creates chapter → shares 6-char code → student joins at `/join` (one chapter per organization) → announcements, check-ins (points), quiz night.
7. **Date change** — admin edits a competition date → previous date stored, "Date changed" chip, optional announcement + notifications → every countdown/plan recomputes on next load.

## 4. Component inventory

`src/components/ui`: Button/ButtonLink, SubmitButton, Card/HeroTexture/IconTile/SectionLabel, Tile/TileGrid/StatStrip, ListGroup/ListRow, Input/Textarea/Select/Label/FieldError/Notice, OrgBadge/Chip/VerificationChip, ProgressBar/Ring, Page/PageTitle/Accent/BackHeader/EmptyState, Toggle/Switch, Markdown (safe subset), ActionForm/ActionButton.
`src/components/app`: CountdownHero, TodayPlan, PlanCard, ReadinessCard, LevelCard, OrgSwitcher, EventSummary/EventFacts, FeedbackView, SpeechInput, InstallCard, Avatar.
`src/components/shell`: BottomNav, Logo, PublicHeader/Footer/PublicPage, ServiceWorkerRegister.

## 5. Data model (`src/db/schema.ts`)

| Area | Tables |
|---|---|
| Identity | `users`, `sessions` (token hash only), `email_codes` (code hash only), `profiles`, `org_preferences`, `notification_prefs`, `push_subscriptions` |
| Catalog | `regions`, `exam_clusters`, `units`, `events` (components + practice rubric JSON, verification status, source URL/date), `competitions` (status confirmed/tentative/unconfirmed, source, previous date) |
| Study | `event_selections` (history; one active per user per org), `plan_tasks`, `season_goals`, `questions` (source: prepx_original / ai_generated / licensed; status published/review/retired), `exam_attempts`, `attempt_answers`, `mistakes`, `lesson_progress`, `flashcards`, `flashcard_reviews` (Leitner), `sprint_bests` |
| AI | `ai_sessions`, `ai_messages`, `ai_feedback` (score, criteria, rubric basis) |
| Motivation | `xp_events` (unique per user/reason/ref → no double awards), `activity_days`, `user_achievements`, `buddies` |
| Chapters | `chapters`, `chapter_members` (unique user+org), `chapter_announcements`, `checkins`, `checkin_records`, `quiz_games`, `quiz_answers` |
| Communication | `announcements`, `announcement_dismissals`, `notifications` (dedupe key), `email_log`, `family_links` |
| Billing | `plan_limits` (admin-editable), `usage_records` (reserved/consumed/refunded), `subscriptions`, `billing_events` (webhook idempotency) |
| Ops | `rate_limits`, `audit_log`, `feedback`, `error_log` |

Every user-owned row references `users.id` with `ON DELETE CASCADE`; rows that must outlive a user (audit log, billing event ids, chapter announcements) use `SET NULL`. Content that changes by season lives in `/content/*.json` and is upserted by `npm run db:seed`, so requirements can be corrected without code changes (and admins can edit events and dates in the console).

## 6. Authorization model

- **Sessions**: random 32-byte token in an `httpOnly`, `SameSite=Lax`, `Secure` (production) cookie; only its SHA-256 is stored. 30-day expiry.
- **Server-side enforcement only.** Every server action and route handler starts with `userOrThrow()` / `requireUser()` / `requireRole()`, and every query that touches a record by id filters by the owner (`and(eq(id), eq(userId))`). Chapter actions call `requireChapterRole(user, chapter, minRole)` (member < officer < advisor). Admin pages require `staff`/`admin`; role changes and plan limits require `admin`. No client-side flag grants access.
- **CSRF**: Server Actions are origin-checked by Next.js; mutating route handlers call `assertSameOrigin`; the Stripe webhook is signature-verified; cron requires a bearer secret (constant-time compare).
- **Rate limits** (Postgres fixed window): sign-in codes per email and IP, code verification per IP, Google callback per IP, AI requests per user, chapter joins and creation, announcements, family invites, feedback, data export.
- **Secrets** are read from server-side env only (`src/lib/env.ts`); the only public variable is `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
- Possible hardening: Postgres row-level security as a second layer; a CSP header (currently `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` are set).

## 7. AI integration

- `src/server/ai/provider.ts` — `aiChat()` and `aiStructured()`; Anthropic implementation with configurable model (`AI_MODEL`, default `claude-opus-5-5`), timeout, one retry, typed error mapping, `stop_reason: "refusal"` handling, and server-side refusal fallback (`fallbacks: "default"`). Structured outputs use Zod schemas and are re-validated.
- `AI_PROVIDER=none` → AI features show "not configured"; `mock` → deterministic test provider (refused in production; every reply is tagged `[Test AI]` and the UI shows a development banner).
- `src/server/ai/tasks.ts` — coach, scenario, evaluation, judge questions, answer rating, explain-back, question generation. Prompts never include the student's name, email or school. The judge may only rate the event's listed criteria; results are labeled "simulated practice score" and, unless an event's rubric is marked verified, "general practice criteria, not the official rubric".
- `src/server/ai/run.ts` — `withUsage()` reserves an allowance unit, runs the call, commits on success and refunds on any failure.
- Retention: transcripts and coach messages kept 180 days (cleanup job), deletable by the student; camera stills are never stored; audio never reaches the server (browser speech recognition).

## 8. Subscription and usage model

- `plan_limits(feature, free_limit, pro_limit, period)` seeded from `content/plans.json` and editable at `/admin/limits` (-1 = unlimited; periods day/month/season/lifetime). Initial: coach 10/day, judge 1/day, judge questions 1/day, explain-back 5/day, full exams 2/season, entry check 1/season, presentation check 1/season (free).
- Pro sources: active Stripe subscription, season boost (one-time, ends Jul 31, no renewal), or a chapter with `covers_pro`.
- `reserveUsage()` takes a per-user/feature advisory lock, counts reserved+consumed in the period, and inserts a reservation; stale reservations (>10 min) are released by the cleanup job.
- Checkout/portal/webhook routes return to the plan page; the page shows Pro only after the webhook has updated the database (no optimistic "success").

## 9. Testing strategy

| Level | Tooling | Scope |
|---|---|---|
| Unit | Vitest (`tests/unit`) | Pure logic: countdown/time zones, plan milestones (reproduces the reference's 190-day screenshot), readiness, daily tasks, streaks, levels, achievements, ICS, join codes, age gate. |
| Integration | Vitest + real Postgres (`tests/integration`, fresh `prepx_test` schema per run) | Entitlements and races, Pro detection, exams (grading, mistakes, drafts, limits, ownership), chapters (codes, expiry, one-per-org, roles, privacy, check-ins, quiz), deletion and export, sign-in codes, AI scoring and refunds, Stripe signature + idempotency, calendar, jobs, referrals. |
| End-to-end | Playwright on Chromium, desktop + Pixel 7 (`tests/e2e`, `prepx_e2e` database, test AI provider) | Registration/onboarding/event selection, under-13 refusal, Quick 10, AI judge + daily limit, coach + no charge on failure, chapter create/join/roles/check-in, privacy settings, calendar + ICS, account deletion, unauthorized access, empty/offline states, mobile navigation without horizontal overflow. |

Plus `tsc --noEmit`, ESLint (Next + React compiler rules) and `next build`.
