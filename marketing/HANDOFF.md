# PrepX handoff for AI agents (website + social media)

This file is self-contained: it covers who PrepX is for, the brand and visual theme, the voice, the app, and the social media setup. [`BRAND_BRIEF.md`](BRAND_BRIEF.md) has the same brand rules in more detail. Everything below reflects the state as of October 12, 2026.

---

## 1. What PrepX is

A **free** competition-prep web app for high school students in **DECA, FBLA, HOSA and TSA**. Students pick their event and get lessons, practice exams, an AI roleplay judge, flashcards and a study plan built around their competition date. It is independent: not affiliated with or endorsed by any of the four organizations.

Positioning line: **"Every event. One place."** Closing line on every ad: **"Free to start."**

---

## 2. Brand, theme and voice

### Audience
- **Who:** high school students, about 14–18, who compete in DECA (business and marketing), FBLA (business leadership), HOSA (health science) or TSA (technology and engineering). Secondary audiences are chapter officers and advisers.
- **What they feel:** prep is scattered across old PDFs, random quiz sites and group chats; nobody gets to practice a roleplay out loud before the real thing; and competition day sneaks up on them.
- **What PrepX promises:** learn it, practice it and rehearse it out loud, in one place, for your exact event, for free.

### Personality
Confident, calm and a little competitive, like a sharp upperclassman who has already been to nationals. Not corporate, not a hype-bro, never cringe. Encouraging, never shaming. "Quiet until it matters."

### Voice and copy rules
- **Headlines are 2–5 words, usually ending in a period:** "Practice roleplays out loud." "Climb the leaderboard." "Walk in ready." "Build your legacy."
- **Emphasize one or two words per headline in the serif italic,** colored with the scene's accent: "Full practice *exams.*"
- Use "you", present tense and plain words: "practice exam", not "assessment module".
- Org names are always in caps: DECA, FBLA, HOSA, TSA.
- Social captions are lowercase and casual, with 1–3 emoji, and end with "free to start".
- **Lines that fit:** "Four competitions. One place to *prepare.*" · "Scores *up.* Streak *up.* Rank *up.*" · "Ten questions a day. That's the whole trick." · "Prep that actually makes *sense.*" · "Every event. *One place.*"

### Visual theme: "Graphite & Volt"
Minimal and premium: graphite and paper neutrals do most of the work, and one electric lime accent ("volt") marks the moments that matter, such as the main button, a progress fill or a success mark.

**Ads and social always use the dark theme:**

| Role | Color |
|---|---|
| Background | `#09090A` (near black) |
| Card | `#111113`, gradient to `#141416`; inner panels `#151517` and `#1F1F22` |
| Hairline borders | white at 8% (16% for stronger lines) |
| Text | `#F2F2EC` (warm off-white); muted `#8D8D86` |
| **Volt (brand accent)** | **`#C6F03A`** |
| Success | `#4FD18B` |

**The app has both themes.** Light mode is warm paper (`#F4F4EF` background, white cards, `#0C0C0D` ink), with volt used only as a fill, never as text on light backgrounds. Dark mode uses the palette above. The app follows the device setting, and users can also pick a theme.

**Organization colors.** The Study area re-themes itself to the selected org, animating when you switch. In ads, an org-specific scene uses that org's color:

| Org | Accent on dark | Glow | Accent on light (in the app) |
|---|---|---|---|
| DECA | `#5B9BFF` | `#2F6FD6` | `#2563EB` |
| FBLA | `#F6C34A` (gold) | `#C99A1C` | `#F4B41A` on navy |
| HOSA | `#F0668F` | `#C23B6A` | `#A3214B` (maroon) |
| TSA | `#FF5C70` | `#E0303F` | `#D4213D` |

**Level colors:** as students level up, the dark-mode background glow shifts from volt to periwinkle (Competitor), then orange (Finalist), violet (Champion) and gold (Legend).

**Rule of thumb:** one accent color per scene. Volt means PrepX itself, and org colors are for org moments.

### Type
- **Geist**, weight 600–800, tight letter-spacing (about −0.045em), for headlines and UI.
- **Geist Mono**, small uppercase with wide spacing (about 0.16em), for labels ("AI JUDGE · DECA") and numbers.
- **Instrument Serif *Italic*** for the one or two emphasized words in a headline.

All three are free Google Fonts, and copies are in `marketing/ads/fonts/`.

### Logo
A rounded square holding an **X whose rising stroke becomes an arrow**, with the arrow in volt. The wordmark is "Prep" in Geist plus an "*X*" in Instrument Serif italic, and the X is colored volt in ads. On dark backgrounds the square is light (`#F2F2EC`) with dark strokes; on light backgrounds it flips. Don't stretch, recolor or rotate it. The SVG for dark backgrounds:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="10" fill="#F2F2EC"/>
  <path d="M10 10 L14 14 M18 18 L22 22" stroke="#09090A" stroke-width="3" stroke-linecap="round"/>
  <path d="M10 22 L22 10" stroke="#09090A" stroke-width="3" stroke-linecap="round"/>
  <path d="M16.2 10 H22 V15.8" fill="none" stroke="#C6F03A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

### How the app looks (and how to mock it in ads)
- **Cards:** rounded 24–28px, hairline border, deep soft shadow. Options and inner panels use 16px corners, and chips and pills are fully rounded.
- **Layout:** a small mono "eyebrow" label on top, a short title, then one clear interaction.
- **Atmosphere:** a soft blurred glow behind the content (volt, or the scene's org color), light film grain and a dark vignette at the edges.
- **Ad mock-ups:** simplified real screens using invented example data ("Maya R.", "Daniel K.") and original questions.

### Motion
- **Entrances:** elements blur in and rise, going from about 14px blur to sharp while moving up about 30px, with ease-out. Exits blur out going up.
- **Headlines** reveal word by word, staggered about 70ms.
- **Everything lands on the beat:** scene changes on bar lines, small interactions on single beats, a roughly 1% camera pulse on each beat, and a bigger kick plus a volt flash on the drop.
- **Signature moves:** numbers count up, ranks climb, streaks tick up and checkmarks draw themselves (the "up" motif matches the logo's arrow). The logo reveal goes: square scales in → X strokes draw → volt arrow draws → "Prep*X*" slides out.
- **In the app:** pages fade and rise in on load, small successes "pop", and everything respects reduced-motion settings.

### Honesty rules (non-negotiable)
1. Not affiliated with DECA, FBLA, HOSA or TSA, so use their names but never their logos, and never say "official".
2. AI judge scores are always "practice" scores.
3. All questions and lessons are original; never claim real past test questions.
4. No invented testimonials, user counts, winner claims or ratings. Example stats get an "Example" tag.
5. No competitor names in ads, and never copy another brand's visuals or copy.
6. No prices or plans: PrepX is free.
7. The audience is teens: keep it school-appropriate, and mute explicit lyrics.

---

## 3. The website / app

### Where things are
- **Repo:** `joeygd2-hue/PrepX`. All work is on branch **`claude/compprep-platform-build-njpezh`**. It is pushed, **not merged, and has no pull request**.
- **Stack:** Next.js 16 (App Router, server actions), React 19, Tailwind v4, PostgreSQL + Drizzle ORM, Anthropic for AI (a mock provider in development and tests), Vitest, and Playwright.
- **Docs:** `docs/CHECKLIST.md` (every feature and its status), `docs/ARCHITECTURE.md` (sitemap, data model, flows), `docs/DESIGN.md` (design system), `docs/CONTENT.md` (study-content format), `docs/DEPLOYMENT.md` (launch setup).

### Status
- **Domain: prep-x.app** (support email: support@prep-x.app). **Not deployed yet.** Don't show the URL or a social handle in ads until the site is live.
- **Launching free.** The app has a "launch period" setting (`app_settings.launch_access`) that gives everyone the full feature set. Stripe billing code and a `/pricing` page exist, but the owner wants no prices or paid plans mentioned. Before launch, keep the launch period on and decide whether to hide `/pricing`.
- **Quality checks on the branch** (last run Oct 12): typecheck, lint and production build all pass; 413/413 unit and integration tests pass; 21/21 Playwright end-to-end tests pass, on desktop and on a Pixel 7 mobile viewport.

### Features (all working)
Event chooser for 231 events · countdown and smart study plan · readiness score · today's plan (sized by the study planner) · **AI judge roleplays** (voice or typed, practice score out of 100) · face-to-face judge and judge-question drills · AI coach · Ask AI on highlighted text · **flip-through course reader** with key-term popovers · adaptive **Quick 10** · full practice exams and test-day rehearsal · mistake notebook · 60-second sprint · flashcards · explain-it-back · **bookmarks with notes** · **head-to-head duels** (code or buddy) · **study planner** (days, minutes, reminder time) · **focus mode** (25-minute timer) · streaks, XP and levels · chapters (join code, check-ins, quiz night, leaderboard) · calendar · organization color themes · installable PWA · admin console.

### Study content
`content/study/<bank>/*.json`: **122 banks, 385 lessons, 3,053 practice questions, 1,961 flashcards**, all original. Every bank was **fact-checked in October 2026** and about 60 errors were fixed. Run `npm run db:seed` after any content change.
- Safe numbers for marketing: **380+ lessons, 3,000+ questions, 1,900+ flashcards, 4 organizations.**
- Still to confirm: FBLA Business Achievement Award levels, listed as Contributor / Leader / Advocate / Capstone.
- Only 25 of 231 event formats are verified against official guidelines. The rest show "Format unverified" in the app.

### Run locally
```bash
git checkout claude/compprep-platform-build-njpezh && npm install
npm run db:migrate && npm run db:seed && npm run dev   # http://localhost:3000
```
Tests: `npm run typecheck`, `npm run lint`, `npm test` (needs Postgres) and `npm run test:e2e`.

### Still to do before launch (outside the code)
Domain and hosting, an Anthropic API key, an email provider, Google OAuth credentials and cron jobs; see `docs/DEPLOYMENT.md`. Also the pricing-page decision above.

---

## 4. Social media (TikTok)

### Account rules
- **Platform:** TikTok first, vertical 9:16 at 1080×1920.
- **No handle or URL** on screen or in captions yet. End every ad on the PrepX logo plus "Free to start."
- **The owner is the final say on music.** They **rejected aggressive or explicit tracks** (an EsDeeKid drill song). Prefer clean, energetic or uplifting sounds, and mute explicit lyrics when a chosen sound has them.
- **Keep content centered** (the owner noticed an off-center layout). Scale content to about 0.89 so it stays clear of TikTok's buttons (right edge, about 140px) and caption (bottom, about 420px).
- **Make the four orgs obvious:** DECA, FBLA, HOSA and TSA by name, each in its org color.
- **Honesty:** no fake winners or testimonials, AI scores are always "practice" scores, any example progress carries an "Example" tag, and no org logos.
- **Real competition footage:** only with permission. Don't imply real winners used PrepX unless they did. Be careful with identifiable minors.

### Ads made so far
Source pages live in [`marketing/ads/`](ads/). The final MP4s were delivered to the owner and are **not in the repo**. The music came from TikTok clips the owner supplied and is **not in the repo** either (copyright); to re-render with sound, ask the owner for the clip.

| File | Name | Length | Sound | Concept |
|---|---|---|---|---|
| `up.html` | Up up up (the original) | 18s | "up up up", 123 BPM, logo on the hit at 13.3s | Org names over color glows → "One place to *prepare*" → AI judge, exam, lessons, leaderboard → "Scores up. Streak up. Rank up." → logo |
| `speed.html` | Speed Round | 19.7s | 129 BPM money-counter sound, drop at 8.57s | "Speed round." → a 3-2-1 countdown → timed DECA/HOSA/TSA questions with reveals → "3/3? Duel a friend." |
| `habit.html` | The 10-Second Habit | 10s, loops | 123 BPM lifestyle sound | Lock-screen streak notification → Quick 10 (10 questions in 10 beats) → streak 23→24 → "Ten questions a day. That's the whole trick." |
| `glowup.html` | Week 1 vs. Competition Week | 20.7s | 112 BPM cars sound, breakdown at 12.9s, drop at 14.54s | A grey week-1 dashboard → "6 weeks later…" → lime stats count up on the drop. Tagged "Example" |
| `flow.html` | Flow (Arabella narration) | 32s | A product-ad music bed with its narration removed | "Your prep gets messy" → big DECA/FBLA/HOSA/TSA tiles → Start-button click on the drop → 3D app flythrough → orbiting feature icons → logo. Narration by the Everygen voice "Arabella", sped up about 18% |
| `legacy.html` | Legacy | 20s | A 144 BPM boxing hype edit, explicit line muted (16–19s) | "Everyone wants the trophy. Nobody wants the work." → 30-day grind montage → "Let them doubt you" → "Build your **legacy**" → leaderboard to #1 → logo |
| `screenshot.html` | Screenshot to find your event (interactive) | 21.8s | The Flow music bed, drop at 9.8s, plus ticks and a camera shutter | "Screenshot to find your event." → how it works → 3-2-1 → 56 real DECA/FBLA/HOSA/TSA events spin, one every 0.1s, with "SCREENSHOT NOW" → shutter → "Got it? Comment your event" → logo |
| `judge.html` | You're the judge (interactive) | 20.7s | The Glow-up sound, plus countdown ticks and a reveal ding | "You're the judge." → two roleplay openers, A and B → "Comment A or B" with a 5-second countdown → votes locked → AI judge practice scores (A 58, B 91) with reasons → logo |
| `org.html` | Which org are you? (interactive) | 19.7s | The Speed Round sound, plus a pop on each reveal | "Which org are you? Pick 1–4" → "Your dream Saturday" with 4 picks → each number reveals DECA, FBLA, HOSA or TSA on the drop → all four tiles → "Built to win DECA, FBLA, HOSA & TSA." |

### How the ads are built
1. Each ad is one HTML page with a pure `window.render(t)` that sets every element's state at time `t`, plus `window.DURATION`. Shared helpers, fonts and the logo end card are in `common.js` and `common.css`.
2. `node marketing/ads/render.mjs <page>.html <outDir> all 30` saves PNG frames with Playwright. Set `PLAYWRIGHT_CHROMIUM_PATH` if needed.
3. Encode with ffmpeg: `ffmpeg -framerate 30 -i out/f%04d.png -c:v libx264 -crf 17 -pix_fmt yuv420p video.mp4`, then mux the audio.
4. Audio prep, in Python:
   - Find beats with `librosa`.
   - **Cut TikTok's outro jingle:** downloaded TikTok clips end with a loud spike; trim just before it.
   - **Remove narration or explicit lines:** separate the vocals with `demucs --two-stems=vocals`, then silence the vocal track in the right windows.
   - Check placement with `faster-whisper` word timestamps.
5. Always deliver two versions, with sound and silent. With the silent one, the owner can attach a trending sound inside TikTok.

### Captions already written
- **Up up up:** "scores up. streak up. rank up. 📈 AI judge roleplays, full practice exams, lessons and leaderboards for DECA, FBLA, HOSA and TSA, all in one place. free to start."
- **Flow:** "your prep doesn't have to be this messy 😮‍💨 lessons, practice exams and AI roleplays for every DECA, FBLA, HOSA and TSA event, all in one app. free to start. ✨"
- **Speed Round:** "3 questions. 2 seconds each. how many did you get? 👀 comment your score 👇 DECA, HOSA and TSA prep in one app. duel your friends on PrepX, free to start."
- **Habit:** "ten questions a day. that's the whole trick 🔥 keep your streak alive with a Quick 10 that goes straight to your weak spots. DECA, FBLA, HOSA and TSA. free to start."
- **Screenshot to find your event:** "screenshot to find your event 📸 comment what you got 👇 then go prep for it with practice questions, lessons and an AI judge. DECA, FBLA, HOSA and TSA. free to start."
- **You're the judge:** "you're the judge 👀 which opener scores higher, A or B? comment before the reveal 👇 practice your roleplays with an AI judge on PrepX. free to start."
- **Which org are you?:** "which org are you? 1, 2, 3 or 4 👇 DECA, FBLA, HOSA or TSA, PrepX preps you for all four. free to start."
- **Hashtags:** #DECA #FBLA #HOSA #TSA #studytok #competitionprep #highschool, plus 1–2 that fit the video.
- Captions are lowercase and casual, end with "free to start", and never include a URL or handle.

### Posting plan agreed with the owner
- One post a day, or at least 4–5 a week, for the first month. Space the ads 2–3 days apart, with simple native posts in between (for example a "question of the day" quiz).
- Post at 3–5pm or 7–9pm on weekdays, and 10am–1pm on weekends; then follow TikTok analytics.
- Post more in the weeks before district, regional and state competitions (late fall through spring).
- Judge each post on watch time, completion rate, shares and comments, after about 48 hours. Repost the best performer with a new hook after about 10 days.

### Competitor notes (for inspiration only; never copy)
CompPrep (compprep.app) runs dark, minimal animated product ads, plus colorful phone-mockup listicles, a "30 days until competition" countdown, "question of the day" quizzes and step-by-step feature demos. What works: a hook in the first second, one idea per scene, and comment bait. Their weakness: ads run 30+ seconds and list too many features.
