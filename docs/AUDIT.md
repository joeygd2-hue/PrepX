# PrepX — Reference audit (CompPrep.app)

PrepX is the product name. CompPrep.app is the functional/visual reference only; no CompPrep source code or brand assets are used.

## 1. Access limitations (read first)

| Source | Result |
|---|---|
| `https://compprep.app/` | **Blocked** from the build container (network policy: `CONNECT 403`, `ENOTFOUND` via fetch tool). No live inspection was possible. |
| `deca.org`, `fbla.org`, `hosa.org`, `tsaweb.org` | **Blocked** the same way. Official pages could not be read directly. |
| Web search (third-party indexes) | Available. Used only for conference dates, each recorded with a confidence level and the page it came from. |
| Screenshots supplied by the owner (desktop browser, 2026‑10‑09, signed-in account) | **Primary evidence.** 20 screenshots covering `/` (Home), `/sign-in`, `/welcome`, `/profile`, `/chapter`, `/join`, `/study`, `/study/events?federation=hosa|deca`, `/study/learn?exam=BAC`, `/calendar/region`. |

Not observed (no screenshot, no access): onboarding steps after `/welcome`, email sign-in screen, Calendar main view, AI judge/coach session screens, practice-exam UI, pricing/checkout, chapter detail for a member, admin screens, mobile-width rendering. These were **built from the requirements** in the master prompt and are marked *Enhancement / inferred* below. To complete the audit, allow the hosts above in the environment's network settings (or supply more screenshots) and re-run Phase 1.

Status legend: **Observed** = visible in a supplied screenshot. **Inferred** = strongly implied by observed text (e.g. a toggle names a feature) but its screen was not seen. **Enhancement** = requested in the master prompt, not evidenced in the reference.

## 2. Global shell — Observed

- Persistent **bottom navigation** on every app page, also on desktop, full width: **Home · Study · Calendar · Chapter · Profile**. Icon + label. Active tab: filled icon, bold label, 2px black outline box.
- Content column ~640px wide, centred; large bold geometric sans headings; small uppercase letter-spaced section labels ("PROFILE", "APP COLOR", "NOTIFICATIONS", "ACCOUNT").
- Cards: light grey fill (#f3f3f3-ish) or white with 1px light border, 16–24px radius. Primary buttons: black, fully rounded pills, white text, optional leading arrow icon. Toggles: black track when on.
- Organisation colour badges: DECA (blue), FBLA (navy), HOSA (maroon), TSA (red); org segmented control with coloured dots.
- Full-screen sub-flows (e.g. `/join`) hide the bottom nav and use a "Cancel" text button.
- Footer on Profile: "CompPrep AI 0.1.0 · Not affiliated with any competition organization." Study footer: "Practice scenarios and scores come from AI and are not official DECA materials or scores."

## 3. Feature inventory

| # | Screen / feature | Visible components | User actions → outcome | Auth | Data | Status |
|---|---|---|---|---|---|---|
| 1 | **Study › Your event** (`/study`) | "STUDY" eyebrow, "Your event"; DECA/FBLA/HOSA/TSA segmented control; event card: org badge, code chip (e.g. PBM), title, "Principles · Business Management and Administration", "Test: Business Administration Core exam (100 questions, 60 min)", "Role-play: 10 min prep, 10 min with the judge, 4 indicators", **Change** link | Switch org; Change event → event chooser | Yes | user event selection, event catalog | Observed |
| 2 | **Countdown + smart plan** | "190 DAYS TO DECA INTERNATIONAL CAREER DEVELOPMENT CONFERENCE", status "On track", "Aim for 80 readiness by competition day · about 28 weeks left"; 4 milestones with circles + "in Nd": *6 weeks out · Learn the material* (Finish 4 lessons; Answer 50 practice questions), *4 weeks out · Practice under pressure* (Take 2 full practice exams; Do 1 AI judge run), *2 weeks out · Sharpen up* (70% on your last 100 questions; 3 AI judge runs total), *1 week out · Game week* (Test-day rehearsal this week; Readiness 80 or higher) | Milestones auto-complete from activity | Yes | competition date, stats | Observed (190 days on 2026‑10‑09 ⇒ ICDC 2027‑04‑17, consistent with DECA's published dates) |
| 3 | **Readiness** | Ring with score (0), "READINESS / Just starting"; bars "Judged practice · 75%", "Consistency · 25%" | — | Yes | judge scores, active days | Observed (weights shown for a role-play event) |
| 4 | **Today's plan** | "TODAY'S PLAN · ABOUT 20 MIN", "0/3", motivational headline ("190 days to DECA Internationals—master PBM fundamentals today!"); 3 checkbox tasks with title · minutes, rationale, type icon (Quick review ⚡, AI Judge run 🎤, Debrief with Coach 💬) | Tick tasks; tap opens tool | Yes | daily tasks | Observed |
| 5 | **Level / XP card** | Level number tile, level name "Rookie", "+0 XP this week", progress bar, "0 XP · 500 to Competitor" | — | Yes | XP ledger | Observed (also on Profile) |
| 6 | **Role-play judge** card | Black card, mic icon, "A realistic role-play with an AI judge, then a DECA-style score.", chip "1 left today" | Start session | Yes | AI, daily quota | Observed (session screens not observed) |
| 7 | **AI coach** card | "Ask about concepts, indicators and strategy.", chip "10 messages left" | Chat | Yes | AI, daily quota | Observed (chat UI not observed) |
| 8 | **Face-to-face judge** | "Sit across from an AI judge · voice, timer, body-language feedback" | Voice session | Yes | mic/camera | Observed (entry only) |
| 9 | **Judge questions** | "20 likely follow-ups · answer out loud, get feedback" | — | Yes | AI | Observed (entry only) |
| 10 | **Exam stats** | Section "BUSINESS ADMINISTRATION CORE EXAM"; tiles: day streak, accuracy (–), questions done | — | Yes | attempts | Observed |
| 11 | **Lessons** (`/study/learn?exam=BAC`) | Back button, "Lessons / Business Administration Core exam"; black progress card "0 OF 13 LESSONS · 0 MASTERED", "Start: Business Law →"; rule text "Each unit: a 5-minute lesson with 3 check questions, then practice. A unit is mastered at 80% on your last 15+ questions."; Units 1–13 (Business Law, Communications, Customer Relations, Economics, Emotional Intelligence, Entrepreneurship, …) each with "Not started" chip | Open unit | Yes | units, progress | Observed |
| 12 | **Quick 10** | "10 questions, instant explanations" | — | Yes | questions | Observed (entry) |
| 13 | **Full practice exam** | "100 questions · 60 minutes, like the real test" | — | Yes | questions | Observed (entry) |
| 14 | **Test-day rehearsal** | "Exam conditions: no pausing, auto-submit, compare with last time" | — | Yes | attempts | Observed (entry) |
| 15 | **Mistake notebook** | "Every miss lands here until you've got it down" | — | Yes | mistakes | Observed (entry) |
| 16 | **60-second sprint** | "As many as you can in a minute · beat your best" | — | Yes | attempts | Observed (entry) |
| 17 | **Explain it back** | "Say a key term in your own words · AI checks you get it" | — | Yes | AI | Observed (entry) |
| 18 | **Flashcards** | "Key terms for your exam" | — | Yes | cards | Observed (entry) |
| 19 | **Choose your event** (`/study/events?federation=hosa`) | "Choose your event", "HOSA 2026-2027 high school events. You can change this anytime.", search ("e.g. medical terminology, CPR"), category sections (HEALTH SCIENCE…), rows: code (BH, BET, DT, HI, HCA, HGD, MLE, MM, MR, MS, MT, ATCBIO…), name, format ("Knowledge Test", "Online Knowledge Test", "Knowledge Test + Spelldown"); "Cancel" | Search, pick event | Yes | event catalog | Observed |
| 20 | **Chapter empty state** (`/chapter`) | "Chapter"; card with icon tile, "No chapter yet", "Join your school's chapter with the code from your advisor or a board member.", "→ Enter a join code" | → `/join` | Yes | membership | Observed |
| 21 | **Join a chapter** (`/join`) | Key icon tile, "Join a chapter", "…You can be in one chapter per competition, like your school's DECA chapter and its FBLA chapter.", "Join code" input (placeholder ABC234, letter-spaced), "→ Join chapter", "Cancel" | Enter 6-char code | Yes | chapters | Observed |
| 22 | Chapter member view, officer/advisor tools, check-in | Implied by "board member", "Check-in is open" notification toggle, "what your chapter covers" | — | Yes | — | Inferred |
| 23 | **Your competitions** (`/calendar/region`) | Back, "Your competitions", "Choose which organizations' dates you see and where you compete. If you're in a chapter, it uses your chapter's district or area."; per org card: badge, "Show dates" toggle; State chips (Texas / Another state); "District / area" chips District 1–12 (District 3 · Fort Bend and Harris counties), Not sure; off state: "Off. Turn on to see FBLA dates." | Toggle orgs, choose region | Yes | prefs | Observed |
| 24 | Calendar main view | — | — | Yes | — | Not observed → built as Enhancement |
| 25 | **Profile header + form** | Initials avatar, name, "Grade 10"; First name, Last name, School, "Save changes" | Save | Yes | profile | Observed |
| 26 | **App color** | Ink, Competitor, Finalist, Champion, Legend swatches; locked ones show lock; "Unlock a new color at each level." | Choose unlocked colour | Yes | level | Observed |
| 27 | **Streak achievements** | "Warming up", "One-week streak", "Month of focus", "Unstoppable" | — | Yes | streak | Observed (labels only; thresholds inferred) |
| 28 | **Notifications** | "Get notifications on this device" + "Turn on notifications"; toggles: Chapter announcements; Check-in is open; Streak reminder (once a day, only if you haven't practiced yet); Competition countdown (a week before and the day before); Weekly recap email (Sunday evening: XP, questions, accuracy) | Toggle; grant push permission | Yes | prefs | Observed |
| 29 | **Family and sharing** | "Monthly email to a parent": days practiced, streak, test accuracy, judge scores; "They confirm first, and you can remove it anytime."; parent email input; "Send them an invite" | Invite → parent confirms | Yes | family link | Observed |
| 30 | **Privacy rows** | "Hide my name on public trophy pages" toggle; "Competition reminder emails" toggle; Download my data; Privacy Policy; Terms of Service; Accessibility; "Privacy questions or a parent's request: privacy@…" | — | Yes | — | Observed |
| 31 | **Account rows** | Your plan ("Pro, season boosts and what your chapter covers"); Ambassador program ("Bring CompPrep to other schools"); Send feedback; Email support; Sign out; Delete my account (red) | — | Yes | billing etc. | Observed (destination screens not observed) |
| 32 | Public trophy pages | Implied by #30 | — | Public | badges | Inferred |
| 33 | Free daily allowances | "1 left today" (judge), "10 messages left" (coach) | — | Yes | usage | Observed |
| 34 | **Home** (`/`) | "FRIDAY, OCTOBER 9" eyebrow, "Hi, Joey", initials avatar button (→ Profile) | — | Yes | profile | Observed |
| 35 | **PWA install card** | Phone icon, "Add CompPrep to your Home Screen", "Opens like an app and can send check-in and announcement alerts.", dismiss ✕, black "Install" | Install / dismiss | Yes | — | Observed |
| 36 | **Announcement banner** | (!) "DECA International Career Development Conference has a new date. Tap to see." | Tap → announcement | Yes | announcements | Observed |
| 37 | **Countdown hero** | Black card: DECA badge, "Date changed" chip, huge "190" + "days to go", conference name, "Sat, Apr 17 – Tue, Apr 20 · Anaheim, CA" | — | Yes | competitions | Observed |
| 38 | **Add your district or area** row | "Choose your district or area to get official dates." | → `/calendar/region` | Yes | prefs | Observed |
| 39 | **Join your chapter** card (Home) | key tile, "Ask your advisor or a board member for your chapter's 6-character join code.", "→ Enter a join code" | → `/join` | Yes | — | Observed |
| 40 | **Practice PBM** row | black mic tile, "AI coach, practice tests and judge for your event" | → Study | Yes | — | Observed |
| 41 | **Stay motivated** list | Study buddies ("See each other's streaks · send a nudge"); Season goals ("Set a target · get a weekly pace"); Quiz night ("Join your chapter's live game"); Invite friends ("Earn XP and badges when friends practice"); Share your wins ("Story cards for streaks and personal bests") | each opens a tool | Yes | various | Observed (destination screens not observed) |
| 42 | **More** list | Send feedback; "I'm an advisor — Start a chapter for your school" | — | Yes | — | Observed |
| 43 | **Sign-in** (`/sign-in`) | Logo + "CompPrep AI"; eyebrow "DECA · FBLA · HOSA · TSA"; "Your competition season, in one place."; subtitle about studying, meeting check-ins, chapter; 4 features (Join with a code; Your chapter, organized; Check-ins and points — "Meeting check-ins and a chapter leaderboard"; Practice and AI judge); card "Get started / Use Google or your email.", "Continue with Google", "or", "Continue with email"; "For people 13 and older. By continuing you'll be asked to agree to our Terms and Privacy Policy."; footer disclaimer + Privacy · Terms · Accessibility · Advisors · Events, support email, © | Google OAuth; email sign-in | Public | — | Observed (email step screen not observed → built as one-time code) |
| 44 | **Welcome** (`/welcome`) | Logo, "Welcome to CompPrep AI, Joey.", "Let's get you ready for competition.", bottom "→ Continue" | → onboarding | Yes | — | Observed |
| 45 | **DECA chooser** | "DECA 2026-2027 high school events.", search "e.g. finance, PFL, marketing", sections "PRINCIPLES (FIRST-YEAR MEMBERS)", "INDIVIDUAL SERIES"…; rows code/name/cluster; selected row shows ✓ | pick | Yes | catalog | Observed |
| 46 | Chapter meeting check-ins, chapter points leaderboard, officers | Named on sign-in page and notification toggles | — | Yes | — | Inferred |
| 47 | Public Advisors and Events pages | Footer links | — | Public | — | Inferred |
| 48 | Pricing, admin, global leaderboards, calendar export, entry/presentation checks | — | — | — | — | Enhancement (master prompt) |

## 4. Competition data evidence

| Item | Value stored | Confidence | Evidence |
|---|---|---|---|
| DECA ICDC 2027 | Apr 17–20, 2027, Anaheim CA | Confirmed | DECA Direct post-conference FAQ (via search); reference countdown "190 days" on 2026‑10‑09 |
| FBLA NLC 2027 | Jun 23–26, 2027, Columbus OH | Tentative | fbla.org "future NLCs" (via search); NYS FBLA |
| HOSA ILC 2027 | Jun 23–26, 2027 (Baltimore) vs Jun 22–25 (Philadelphia) | **Unconfirmed — conflicting** | hosa.org countdown page vs. third-party citing 2026–27 GRR |
| TSA National 2027 | Jun 23–27, 2027, location TBA | Unconfirmed | North Dakota CTSO date sheet only |
| Texas DECA districts | District 1–12; "District 3 · Fort Bend and Harris counties" | Observed | screenshot #23 |
| District/state dates | none seeded | — | must be entered by admins from official sources |
| HOSA event list (subset) | codes/names/formats in screenshot #19 | Observed | screenshot |
| DECA PBM format | BAC exam 100 q / 60 min; role-play 10+10 min, 4 PIs | Observed | screenshot #1 |
| All other event formats | from general knowledge | **Unverified** — flagged in UI | needs official-source check |
