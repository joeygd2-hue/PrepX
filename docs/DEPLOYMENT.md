# PrepX — Deployment and operations

## 1. What you need

| Service | Required? | Used for |
|---|---|---|
| Node.js 20.9+ host for Next.js 16 (Vercel, Render, Fly.io, a container…) | Yes | The app |
| PostgreSQL 14+ (Neon, Supabase Postgres, RDS, Cloud SQL…) | Yes | All data |
| Email: Resend account + verified sending domain | Yes in production | Sign-in codes, parent invites, reminders |
| Google Cloud OAuth client | Optional | "Continue with Google" |
| Anthropic API key | Optional | AI coach, judge, checks (features show "not configured" without it) |
| Stripe account | Optional | Pro subscription and season boost |
| VAPID key pair | Optional | Web push on devices |
| A scheduler (Vercel Cron, GitHub Actions, cron-job.org…) | Recommended | Reminders, recaps, parent emails, retention cleanup |

## 2. Environment variables

Copy `.env.example` and fill in values. Everything is read server-side; only `NEXT_PUBLIC_VAPID_PUBLIC_KEY` reaches the browser.

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Postgres connection string. Use a pooled URL on serverless hosts. |
| `APP_URL` | Public origin, e.g. `https://prepx.app`. Used in emails and OAuth redirects. |
| `SUPPORT_EMAIL`, `PRIVACY_EMAIL` | Real, monitored inboxes; shown throughout the app and legal pages. |
| `ADMIN_EMAILS` | Comma-separated; these accounts are promoted to `admin` on sign-in. |
| `EMAIL_PROVIDER=resend`, `EMAIL_FROM`, `RESEND_API_KEY` | `console` is refused in production. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | See §4. |
| `AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`, `AI_MODEL`, `AI_TIMEOUT_MS` | See §5. `mock` is refused in production. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_SEASON_BOOST` | See §6. Checkout is hidden until the first three are set. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | `npx web-push generate-vapid-keys` |
| `CRON_SECRET` | Long random string; scheduler sends `Authorization: Bearer <secret>`. |
| `TRUSTED_PROXY_COUNT` | Default `1`. Number of reverse proxies in front of the app that append to `X-Forwarded-For`; see the note below. |
| `TRUST_CF_CONNECTING_IP` | `true` to take the client address from Cloudflare's `CF-Connecting-IP`. Only when the origin accepts traffic from Cloudflare alone. |

**Client IP for rate limits.** Sign-in and other abuse limits key on the client address, so it must not come from anything the client can set. On Vercel (`x-vercel-forwarded-for`) and Fly.io (`Fly-Client-IP`) the platform's own header is used automatically. Elsewhere each proxy appends the address it received the request from to `X-Forwarded-For`, and PrepX takes the entry `TRUSTED_PROXY_COUNT` places from the right; anything further left is client-supplied and ignored. Set it to the number of proxies that append (nginx with `proxy_add_x_forwarded_for`, Render or a load balancer: `1`; a CDN in front of nginx: `2`), and make sure the app can't be reached without going through them. Too low a value makes all traffic share the nearest proxy's address; too high lets clients choose their own. Use `0` only when the proxy sets `X-Real-IP` (replacing any value the client sent) and doesn't append to `X-Forwarded-For`.

## 3. First deploy

```bash
npm ci
DATABASE_URL=... npm run db:migrate     # applies drizzle/*.sql
DATABASE_URL=... npm run db:seed        # events, competitions, regions, study content, plan limits (idempotent)
npm run build
npm start                               # or let your host run `next start`
```

On Vercel: set the env vars in the project, set the build command to `npm run db:migrate && npm run build` (or run migrations from CI), and run `npm run db:seed` once from your machine against the production database. Re-running the seed is safe: it upserts by stable ids and never overwrites competition dates that admins edited. After pulling new study content (`content/study/**`), run `npm run db:seed` again to load it.

Then sign in with an address in `ADMIN_EMAILS`, open `/admin`, and check the Integrations panel.

## 4. Google OAuth

1. Google Cloud Console → APIs & Services → OAuth consent screen: External, app name "PrepX", support email, scopes `openid`, `email`, `profile`. Publish the app.
2. Credentials → Create OAuth client ID → Web application.
   - Authorized JavaScript origin: `https://<your-domain>`
   - Authorized redirect URI: `https://<your-domain>/api/auth/google/callback`
3. Put the client id/secret in `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

The callback verifies the OAuth `state` and PKCE verifier, accepts only Google-verified emails, and links Google to an existing account with the same email.

## 5. AI provider

- Create an Anthropic API key (console.anthropic.com) and set `AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`.
- `AI_MODEL` defaults to `claude-opus-5-5`. A lower-cost model (e.g. `claude-sonnet-5-5`) can be set for high-volume use; evaluate feedback quality before switching.
- Requests use structured outputs, adaptive thinking at low/medium effort, a 60 s timeout (`AI_TIMEOUT_MS`) and server-side refusal fallback. Failed calls are refunded to the student's allowance.
- Daily allowances are set in `/admin/limits`. Watch spend in the Anthropic console and the "AI uses (24h)" metric in `/admin`.

## 6. Payments (Stripe)

1. Create two Prices: a recurring monthly price (Pro) and a one-time price (Season boost).
2. Set `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_SEASON_BOOST`.
3. Add a webhook endpoint `https://<your-domain>/api/stripe/webhook` for `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`; put its signing secret in `STRIPE_WEBHOOK_SECRET`.
4. Enable the Customer Portal (cancel at period end) in Stripe settings.

Users see Pro only after the webhook updates the database. Events are deduplicated by id. Account deletion cancels an active subscription.

### Free launch period

The first migration run creates a launch period that gives every student Pro for four weeks (`app_settings.launch_access`). Change the last free day or end it early in `/admin/limits` (admins only). While it's on, Home, Study and the plan page say so; no card is collected and nothing converts to a paid plan when it ends.

## 7. Scheduled jobs

Call each endpoint with `Authorization: Bearer $CRON_SECRET`:

| Endpoint | Schedule | Purpose |
|---|---|---|
| `/api/cron/streak-reminders` | hourly | 6 pm local, only students with a streak who haven't practiced today |
| `/api/cron/weekly-recaps` | hourly | Sunday 6 pm local recap email (skipped if nothing to report) |
| `/api/cron/competition-reminders` | daily | 7 days and 1 day before each student's competition |
| `/api/cron/parent-monthly` | daily | On the 1st: confirmed parents' summary with a fresh stop link |
| `/api/cron/cleanup` | daily | Retention: AI transcripts > 180 days, expired sessions/codes, logs > 30 days, stale reservations |

`vercel.json` in the repo defines these schedules for Vercel Cron, which sends the `CRON_SECRET` bearer automatically when the env var is set (hourly schedules need a paid Vercel plan; on Hobby, use an external scheduler for the hourly jobs).

## 8. Keeping competition data current

Official sites could not be reached from the build environment, so every event not marked "Format checked"/"Verified" must be confirmed before launch:

1. `/admin/events?v=unverified` → open each event, compare with the official guidelines (DECA deca.org/compete, FBLA fbla.org/high-school/competitive-events, HOSA hosa.org/guidelines, TSA tsaweb.org/competitions), update components, set status to Verified with the source URL and the date checked.
2. `/admin/competitions` → confirm international/national dates (HOSA ILC 2027 and TSA 2027 are flagged unconfirmed), add state and district dates with sources.
3. Rubrics: the practice criteria are general and labeled as such. Only mark a rubric "verified" after checking it against the official rubric, and never add official point values unless you've verified them and are permitted to use them.

## 9. Before launch: unresolved legal and compliance items

These need review by a qualified professional; PrepX does not claim compliance just because policies exist.

- **COPPA**: the app refuses under-13 sign-ups and deletes their input. Confirm the age-gate design, the "actual knowledge" process (privacy@ requests) and that no under-13 data is retained in logs.
- **State student-privacy laws** (e.g. California SOPIPA/CCPA-CPRA for minors, NY Ed Law 2-d if sold to schools) and **FERPA** if schools/districts contract for chapter Pro.
- **Terms and Privacy Policy**: drafts in the app, marked "Draft pending legal review". Replace with counsel-approved versions; set real `SUPPORT_EMAIL`/`PRIVACY_EMAIL`.
- **Minors and purchases**: checkout tells under-18 users to get parental permission; consider requiring parent-initiated purchase.
- **AI provider terms**: confirm data-retention/zero-retention settings and that the provider permits use with teenage users.
- **Trademarks**: DECA, FBLA, HOSA and TSA names are used descriptively with a non-affiliation notice; review before marketing.
- **Accessibility**: the statement claims a WCAG 2.2 AA target, not certification; schedule an independent audit.
- **Email**: set SPF/DKIM/DMARC for the sending domain; sign-in emails are transactional and always sent.

## 10. Native mobile later

The backend is a set of server actions and route handlers over Postgres. To ship native apps, either wrap the PWA (Capacitor/TWA) or move the server-action logic in `src/server/**` behind JSON route handlers and authenticate with the same session tokens (sent as a bearer header instead of a cookie). The pure logic in `src/lib/**` is framework-free and portable.
