# PrepX — Feature checklist

Status of every feature against the reference audit ([AUDIT.md](AUDIT.md)) and the build brief.

- **Source** — `R#` = observed in the reference app (row number in AUDIT.md §2), `R (inferred)` = implied by the reference but not directly observed, `E` = enhancement requested in the brief.
- **Status** — ✅ Implemented · 🟡 Partially implemented · ⛔ Blocked (needs something outside the codebase) · ❌ Not implemented.

The visual design deliberately departs from the reference ("Graphite & Volt", see [DESIGN.md](DESIGN.md)) at the owner's request; layouts and features are kept.

## Audit

| Item | Source | Status | Notes |
|---|---|---|---|
| Live audit of compprep.app | — | ⛔ | The site and the four organizations' sites were blocked by the build environment's network policy. The audit uses the owner's 20 screenshots and is explicit about what was observed vs inferred. |
| Feature inventory (screen, components, actions, auth, data, status) | — | ✅ | AUDIT.md §2, 48 rows. |

## Accounts and onboarding

| Feature | Source | Status | Notes |
|---|---|---|---|
| Sign-in landing ("Get started", Google / email) | R43 | ✅ | `/sign-in`. |
| Continue with Google | R43 | ✅ | OAuth with state + PKCE; Google-verified emails only. Needs `GOOGLE_CLIENT_ID/SECRET`. Google name claims are held in a 1-hour cookie until the age check passes, not saved. |
| Continue with email | R43 | ✅ | Passwordless 6-digit code (hashed, 10-minute TTL, 5 attempts enforced atomically, per-email and per-IP limits). |
| Password reset | E | — | Not applicable: there are no passwords. |
| Secure sessions and sign-out | E | ✅ | Random token in an httpOnly cookie, only its SHA-256 stored, 30-day expiry; sign-out deletes the session. |
| Welcome screen | R44 | ✅ | `/welcome`. |
| Onboarding: date of birth first, then name/display name, grade, school, state, organizations, terms | E | ✅ | Resumable (`profiles.onboarding_step`). The age check comes first so nothing else is collected from someone under 13. |
| Under-13 refusal | E | ✅ | Account and inputs deleted immediately; the same browser can't retry with another date for 24 hours. |
| Cancel sign-up during onboarding | E | ✅ | Deletes the account and everything entered. Abandoned sign-ups are deleted automatically after 7 days. |

## Home

| Feature | Source | Status | Notes |
|---|---|---|---|
| Date eyebrow + greeting by preferred name | R34 | ✅ | Time-of-day greeting in the student's time zone. |
| Install-to-Home-Screen card | R35 | ✅ | Android/desktop install prompt; iOS instructions; dismissible. |
| Announcement banner → announcement page | R36 | ✅ | Admin-managed, per organization, dismissible. |
| Countdown hero (org badge, "Date changed", days to go, name, dates, location) | R37 | ✅ | Computed per request in the viewer's time zone; never hard-coded. Tentative/unconfirmed dates are labeled. |
| "Add your district or area" row | R38 | ✅ | → `/calendar/region`. |
| "Join your chapter" card | R39 | ✅ | Hidden once the student is in a chapter. |
| Practice shortcut for the selected event | R40 | ✅ | |
| Today's plan | R4 | ✅ | Also on Study. |
| Level / XP card | R5 | ✅ | |
| Streak tile | E | ✅ | |
| Stay motivated: buddies, goals, quiz night, invite, share | R41 | ✅ | Each opens a working tool (see Social). |
| Leaderboards entry | E | ✅ | |
| More: send feedback, "I'm an advisor" | R42 | ✅ | |
| New-user state (no event yet) | E | ✅ | "Choose your event" hero. |

## Study

| Feature | Source | Status | Notes |
|---|---|---|---|
| Org switcher (DECA/FBLA/HOSA/TSA) | R1 | ✅ | One active event per organization; switching keeps each selection. |
| Event card with format lines and Change | R1 | ✅ | |
| Event chooser with search and categories | R19, R45 | ✅ | 231 events. |
| Event details before selecting | E | ✅ | Format, practice criteria, verification status, official source link. |
| Changing events keeps history | E | ✅ | Previous selections kept inactive; rubrics are per event. |
| Event catalog fields (org, category, division, format, exam, role-play/presentation/interview, time limits, questions, criteria, levels, source, last verified) | E | 🟡 | Structure complete and admin-editable. Only 25 of 231 events have formats checked against a published reference; the rest are clearly marked "Format unverified" until an admin verifies them against the official guidelines (official sites were unreachable from the build environment). |
| Smart plan with milestones (6/4/2/1 weeks out) | R2 | ✅ | Built from the real date, event shape and recorded activity; condensed automatically when the date is close; custom target date supported. |
| Readiness score with weighted parts | R3 | ✅ | Weights depend on the event's format. |
| Today's plan (2–4 tasks, minutes, rationale, auto-complete) | R4 | ✅ | Tasks complete automatically from server-recorded activity; manual ticks earn no XP. Sized from the study planner's minutes for today; rest days show as optional practice. Links to focus mode and the planner. |
| Role-play / presentation judge (AI) | R6 | ✅ | Prep timer, voice or typing, practice score labeled as simulated, free retry if scoring fails. |
| AI coach | R7 | ✅ | |
| Face-to-face judge (voice, timer, optional camera stills) | R8 | ✅ | Stills only with explicit consent, never stored. |
| Judge questions | R9 | ✅ | One feedback per question per session. |
| Exam stats (streak, accuracy, questions done) | R10 | ✅ | |
| Lessons with mastery rule | R11 | ✅ | Every event has a study bank: its official test topic or, for events without a test, a practice knowledge bank (`components.knowledge`). Original lessons, questions and flashcards per bank; see [CONTENT.md](CONTENT.md). All 122 banks (385 lessons, 3,000+ questions) were fact-checked in October 2026: answer keys, calculations, current guidelines (e.g. 2025 AHA choking and infant CPR), and organization facts. |
| Course reader | E | ✅ | Lessons flip page by page (swipe, keys or buttons) with a segmented progress bar, key-term highlights with definitions, a quick check and a course overview with progress rings per unit. |
| Quick 10 | R12 | ✅ | Adaptive: weighted toward weak units, includes open mistakes, avoids recently answered questions. |
| Full practice exam (timed, resumable) | R13 | ✅ | Counts against the free allowance (2 per season). |
| Test-day rehearsal | R14 | ✅ | No pausing, auto-submit, comparison with the last attempt. |
| Mistake notebook | R15 | ✅ | Cleared after two correct answers. |
| 60-second sprint | R16 | ✅ | Personal best kept. |
| Explain it back (AI) | R17 | ✅ | |
| Format lessons ("Master the format") | E | ✅ | Role-plays, case studies, presentations, written entries, interviews, projects, test-taking; shown for each part of an event. |
| Study resources | E | ✅ | Official competitive-events page plus curated free resources per bank (open textbooks, public agencies), each found and checked through web search. |
| Ask AI on highlighted text | E | ✅ | Select text on any study page for an explanation, definition, example or simpler version; type follow-ups; off during timed exams. Own daily allowance, refunded on failure, nothing stored. |
| Organization themes | E | ✅ | The Study area takes on DECA, FBLA, HOSA or TSA colors (light and dark), animated when switching. |
| Flashcards (Leitner review, mark difficult) | R18 | ✅ | |
| Bookmarks with private notes | E | ✅ | Save any answered question with a note; practice the saved set as its own attempt. Linked from Study. |
| Head-to-head duels | E | ✅ | Challenge a study buddy or share a 6-character code; both players get the same questions; most right wins, ties go to the faster finish. Linked from Study when the bank has enough questions. |
| Study planner | E | ✅ | Pick study days, minutes per day and a reminder time; streak reminders go out at the student's chosen hour. |
| Focus mode | E | ✅ | Distraction-free 25-minute timer (adjustable) with pause/resume, a break, a chime and screen wake lock; shows today's planned minutes. |
| Attempt history and topic breakdown | E | ✅ | |
| Written entry check / presentation check | E | ✅ | Only shown for events with those components. |
| AI-generated questions kept separate from original ones | E | ✅ | Source + review status per question; admins approve before publishing. |

## Calendar

| Feature | Source | Status | Notes |
|---|---|---|---|
| Your competitions: show-dates toggles, state and district per org | R23 | ✅ | `/calendar/region`. |
| Calendar view | R24 (not observed) / E | ✅ | Agenda and month views, filters by organization and level, personal study milestones. |
| Confirmed / tentative / unconfirmed labels with sources | E | ✅ | |
| Add to Google Calendar / Apple Calendar (ICS) | E | ✅ | Per item and whole-calendar ICS download; nothing is written to a calendar without the student's action. |
| District and state dates | E | ⛔ | Data model and admin editor ready; no dates seeded because official sources couldn't be reached. Admins add them with a source. |

## Chapters

| Feature | Source | Status | Notes |
|---|---|---|---|
| "No chapter yet" empty state | R20 | ✅ | |
| Join with a 6-character code | R21 | ✅ | Validation, expiry, rotation, one chapter per organization, rate-limited. |
| Member view, roles (member/officer/advisor), management | R22 (inferred) | ✅ | Server-enforced role checks; promote, remove, leave, advisor hand-off. |
| Check-ins and chapter points | R46 (inferred) | ✅ | |
| Chapter leaderboard | R46 (inferred) | ✅ | Leaders see everyone's points; other members see only students who opted into leaderboards (nickname or name). |
| Chapter announcements | E | ✅ | With notifications. |
| Chapter study activity | E | ✅ | Weekly question count, shown to leaders only for students who opt in (off by default; asked when joining). |
| Quiz night (live game) | R41 | ✅ | Host and play, live polling. |
| Start a chapter (advisor) | R42 | ✅ | |

## Profile and settings

| Feature | Source | Status | Notes |
|---|---|---|---|
| Header, name, school, grade, save | R25 | ✅ | |
| Avatar | E | 🟡 | Initials avatar. Photo upload deliberately not implemented to avoid storing student photos. |
| App color unlocked by level | R26 | ✅ | |
| Streak achievements and other badges | R27 | ✅ | Thresholds are PrepX's own (reference labels only). |
| Notification preferences + device push | R28 | ✅ | Push only after permission; needs VAPID keys. |
| Family sharing (monthly parent email, parent confirms) | R29 | ✅ | Parent sees a summary only; student can remove it. |
| Privacy toggles, download my data, policy links | R30 | ✅ | Export covers every table that holds the student's data. |
| Your plan, ambassador, feedback, support, sign out, delete account | R31 | ✅ | Deletion is real (backend cascade), explains what is deleted and kept, cancels any subscription first. |
| Public trophy pages | R32 (inferred) | ✅ | Name hidden by default. |
| Global and organization leaderboards | E | ✅ | Opt-in, random nickname or display name, server-recorded study XP only. |
| Study buddies, season goals, invites/referrals, share cards | R41 | ✅ | |

## Plans and billing

| Feature | Source | Status | Notes |
|---|---|---|---|
| Free daily allowances shown ("1 left today", "10 messages left") | R33 | ✅ | |
| Configurable Free/Pro limits | E | ✅ | `/admin/limits`; initial values from the brief. |
| Free launch period | E | ✅ | Pro for everyone until a date (four weeks after the database migration by default), shown on Home, Study and the plan page; admins change or end it in `/admin/limits`. |
| Server-side usage tracking; failed AI calls not charged | E | ✅ | Reserve → commit/refund with an advisory lock. |
| Stripe checkout, portal, webhooks | E | ⛔ | Implemented and tested with signed test events; needs Stripe keys and prices to go live. No fake success states. |
| Season boost | E | ✅ | Refused while a monthly subscription is active. |
| Chapter-covered Pro | E | ✅ | |

## Platform

| Feature | Source | Status | Notes |
|---|---|---|---|
| Bottom navigation: Home, Study, Calendar, Chapter, Profile | R (screenshots) + E | ✅ | Floating dock; labels on larger screens. |
| PWA: manifest, icons, install, offline page | E | ✅ | Service worker caches only static assets, never personal data. |
| Light and dark mode | E | ✅ | Follows the device setting. |
| Page transitions | E | ✅ | Short fade-and-rise on load, refresh and navigation; disabled under reduced motion. |
| Admin console (events, dates, announcements, questions, chapters, feedback, limits, users, health) | E | ✅ | Staff/admin roles enforced on the server. |
| Rate limits (sign-in, AI, joins, invites, feedback, export) | E | ✅ | Client IP taken from a trusted proxy hop, not the spoofable left-most `X-Forwarded-For`. |
| Row-level security in Postgres | E | 🟡 | Authorization is enforced in one server data-access layer and covered by tests; RLS as a second layer is documented as possible hardening. |
| AI moderation | E | 🟡 | Provider refusals handled; prompts restrict the judge to the event's criteria and exclude personal data. No separate moderation model. |
| Native mobile packaging | E | 🟡 | Not packaged; the backend is ready to be reused (see DEPLOYMENT.md §10). |
| Legal/compliance review (COPPA, state student-privacy laws, terms) | E | ⛔ | Flagged in DEPLOYMENT.md §9; policies are drafts pending legal review. |

## Tests

Unit, integration (real Postgres) and end-to-end (Playwright, desktop + Pixel 7) suites cover the 20 journeys listed in the brief; see ARCHITECTURE.md §9. Run `npm test` and `npm run test:e2e`.
