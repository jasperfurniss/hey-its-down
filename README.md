# Hey it's down

Cheap commercial HTTP GET + SSL expiry checks. Freshping stopped March 6, 2026. UptimeRobot’s free plan **allows commercial use** at 5-minute intervals; their paid 1-minute is about $7–10/mo. This product’s founding year is **$20 for 12 months** (10 URLs). Free here is 1 URL, every 5 minutes, commercial use allowed.

Placeholder domain: [heyitsdown.com](https://heyitsdown.com). Live marketing page this MVP is based on: [glittering-tapioca-315132.netlify.app](https://glittering-tapioca-315132.netlify.app).

## Honest limits

This MVP checks **every 5 minutes for every plan**, including founding. 1-minute is the intended paid interval. Netlify’s free scheduled functions cannot run every minute, so the UI does not claim that they do.

v1 includes: HTTP GET, SSL expiry warnings (within 14 days), email and/or a Slack incoming webhook, and a public SVG badge. v1 does **not** include SMS, phone, team seats, incident management, or status-page comments.

## Run locally

```bash
npm install
npm test
npm run dev
```

Then open [http://127.0.0.1:8888](http://127.0.0.1:8888). The landing page is `/`. The app is `/app` (also `/start`).

`npm run dev` is a small Node server that uses the same check/alert/monitor code as production. **Storage is in-memory** unless a Netlify Blobs context is present, so monitors disappear when you stop the process. That local fallback is not the production store.

Production-like:

```bash
npx netlify-cli dev
```

That serves the static site, Netlify Functions, and (when logged into a site) Netlify Blobs. A local `netlify dev` session can emulate Blobs; a JSON file is never the production store.

## Environment variables

| Variable | Required | What it does |
| --- | --- | --- |
| `RESEND_API_KEY` | No | If set (with `ALERT_FROM_EMAIL`), UP↔DOWN and SSL-expiry alerts are emailed via [Resend](https://resend.com). If unset, email is skipped; the alert is still recorded on the monitor. |
| `ALERT_FROM_EMAIL` | With Resend | Verified Resend from-address, e.g. `Hey it's down <alerts@yourdomain.com>`. |
| `STRIPE_PAYMENT_LINK` | No | If set, founding CTAs go to this Stripe Payment Link. If unset, the UI shows **founding $20 — checkout coming**. Checkout does **not** automatically set `plan=founding`. |
| `FOUNDING_EMAILS` | No | Comma-separated emails treated as founding (10 URLs). Also written as `plan=founding` on the account. Operator stub until Stripe webhooks exist. |

Copy `.env.example` to `.env` for local use. Set the same keys in the Netlify site env for production.

## How scheduled checks work

A Netlify scheduled function (`netlify/functions/scheduled-check.js`) runs on cron `*/5 * * * *` (every 5 minutes). It lists every monitor in Netlify Blobs, performs an HTTP GET, reads TLS certificate expiry on HTTPS, and:

- On **state change** (UP↔DOWN), sends email (if Resend is configured) and POSTs the Slack webhook if the user pasted one.
- If SSL expires **within 14 days**, sends that alert once per certificate expiry date (not every 5 minutes).

The first check after you add a URL runs **immediately** in `POST /api/monitors`, so the UI can show UP/DOWN without waiting for cron. The first check does not send an UP/DOWN alert (there is no previous state). SSL-expiry still can.

On the local Node server, you can trigger the same job with `GET` or `POST` `/api/run-checks`.

## Persistence

Production uses **Netlify Blobs**:

- Store `monitors` — one JSON object per monitor id
- Store `accounts` — key `encodeURIComponent(email)`, `{ email, plan, monitorIds }`

`plan` is `"free"` or `"founding"`. Free: 1 URL. Founding: 10 URLs.

To mark someone paid without `FOUNDING_EMAILS`, edit the account blob and set `"plan": "founding"`.

## Public badge

`GET /badge/:id.svg` is public, `Cache-Control: no-cache, no-store, must-revalidate`. Example:

```
https://your-site.netlify.app/badge/<monitor-id>.svg
```

A 200 HTTP response is **UP**. Connection failure (and non-2xx) is **DOWN**.

## What is real vs stubbed

| Piece | Status |
| --- | --- |
| Add URL, immediate check, last status in `/app` | Real |
| HTTP GET + SSL expiry | Real |
| Public SVG badge | Real |
| 5-minute scheduled checks (Netlify) | Real, once deployed with functions |
| Netlify Blobs persistence | Real in Netlify production; in-memory only for `npm run dev` without Blobs |
| Slack incoming webhook POST | Real if the user pastes a `hooks.slack.com` URL |
| Email via Resend | Real **only** if `RESEND_API_KEY` and `ALERT_FROM_EMAIL` are set; otherwise skipped and recorded |
| Stripe founding checkout | **Stub.** `STRIPE_PAYMENT_LINK` if present; otherwise “checkout coming”. No webhook, no auto-upgrade |
| 1-minute paid interval | **Not running.** Disclosed in the UI |
| Pro monthly $6 / yearly $60 | Coming later, not for sale |

## Deploy on Netlify

Connect this repo. Publish directory is `public`. Functions directory is `netlify/functions`. Scheduled functions require a Netlify plan that allows them (they still run every 5 minutes here, not every minute).
