# PrepX handoff for AI agents (website + social media)

Read this first, then [`BRAND_BRIEF.md`](BRAND_BRIEF.md) (voice, colors, fonts, logo, honesty rules). Everything below reflects the state as of October 12, 2026.

---

## 1. What PrepX is

A **free** competition-prep web app for high school students in **DECA, FBLA, HOSA and TSA**. Students pick their event and get lessons, practice exams, an AI roleplay judge, flashcards and a study plan built around their competition date. It is independent: not affiliated with or endorsed by any of the four organizations.

Positioning line: **"Every event. One place."** Closing line on every ad: **"Free to start."**

---

## 2. The website / app

### Where things are
- **Repo:** `joeygd2-hue/PrepX`. All work is on branch **`claude/compprep-platform-build-njpezh`**. It is pushed, **not merged, and has no pull request**.
- **Stack:** Next.js 16 (App Router, server actions), React 19, Tailwind v4, PostgreSQL + Drizzle ORM, Anthropic for AI (a mock provider in development and tests), Vitest, and Playwright.
- **Docs:** `docs/CHECKLIST.md` (every feature and its status), `docs/ARCHITECTURE.md` (sitemap, data model, flows), `docs/DESIGN.md` (design system), `docs/CONTENT.md` (study-content format), `docs/DEPLOYMENT.md` (launch setup).

### Status
- **Not deployed. No domain yet.** Don't publish or show a URL or social handle anywhere until the owner provides one.
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

## 3. Social media (TikTok)

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
- **Hashtags:** #DECA #FBLA #HOSA #TSA #studytok #competitionprep #highschool, plus 1–2 that fit the video.
- Captions are lowercase and casual, end with "free to start", and never include a URL or handle.

### Posting plan agreed with the owner
- One post a day, or at least 4–5 a week, for the first month. Space the ads 2–3 days apart, with simple native posts in between (for example a "question of the day" quiz).
- Post at 3–5pm or 7–9pm on weekdays, and 10am–1pm on weekends; then follow TikTok analytics.
- Post more in the weeks before district, regional and state competitions (late fall through spring).
- Judge each post on watch time, completion rate, shares and comments, after about 48 hours. Repost the best performer with a new hook after about 10 days.

### Competitor notes (for inspiration only; never copy)
CompPrep (compprep.app) runs dark, minimal animated product ads, plus colorful phone-mockup listicles, a "30 days until competition" countdown, "question of the day" quizzes and step-by-step feature demos. What works: a hook in the first second, one idea per scene, and comment bait. Their weakness: ads run 30+ seconds and list too many features.
