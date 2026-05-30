# monarch-tools

A TypeScript/Node.js toolkit for pulling personal financial data from
[Monarch Money](https://www.monarchmoney.com/) and turning it into **push-based
alerts and email reports** — budget warnings, large-purchase alerts, anomaly
detection, upcoming-bill reminders, and daily/weekly digests.

It is built on the community [`monarchmoney`](https://www.npmjs.com/package/monarchmoney)
client (Monarch has no official API), and is designed to run unattended on a
schedule (e.g. macOS `launchd`).

> **Note:** This is a personal automation project, not affiliated with Monarch
> Money. Use it against your own account and in line with Monarch's terms.

## Features

- **Auth** — email/password with optional TOTP (MFA) via a secret key; sessions
  are cached locally and re-authenticated automatically on expiry.
- **Fetchers** — transactions, budgets, cashflow, and recurring merchants.
- **Alerts** — large purchases, budget status, spending anomalies, new recurring
  charges, and upcoming bills, with de-duplication to avoid repeat emails.
- **Reports** — daily digest and weekly summary, rendered as HTML email.
- **Email delivery** — via Gmail (using an App Password).

## Setup

```bash
npm install
cp .env.example .env   # then fill in your values
```

Edit `.env`:

| Variable | Required | Description |
| --- | --- | --- |
| `MONARCH_EMAIL` | yes | Monarch account email |
| `MONARCH_PASSWORD` | yes | Monarch account password |
| `MONARCH_MFA_SECRET` | if MFA on | TOTP secret from Monarch → Settings → Security |
| `GMAIL_USER` | for email | Gmail address used to send reports |
| `GMAIL_APP_PASSWORD` | for email | [Gmail App Password](https://myaccount.google.com/apppasswords) |
| `ALERT_RECIPIENTS` | for email | Comma-separated recipient list |

Alert thresholds (large-purchase amount, budget warning %, anomaly multiplier,
etc.) are optional overrides — see `.env.example` for the full list and defaults.

## Usage

```bash
npx tsx scripts/test-auth.ts          # verify login + list accounts
npx tsx scripts/run-alerts.ts         # evaluate alerts and email any that fire
npx tsx scripts/run-daily-digest.ts   # send the daily digest
npx tsx scripts/run-weekly-summary.ts # send the weekly summary
```

## Scheduling (macOS launchd)

`scripts/launchd-run.sh` is a wrapper that resolves the repo root, sets up
logging under `~/.mm/logs`, and supports a daily/weekly run guard:

```bash
scripts/launchd-run.sh --guard daily run-daily-digest.ts
```

Because `launchd` starts jobs with a minimal `PATH`, set `MONARCH_NODE_BIN` to
your node `bin` directory (e.g. an nvm install path) in the environment or via
the launchd plist's `EnvironmentVariables`.

## Project layout

```
src/
  auth.ts         # authenticated client (session cache + TOTP)
  config.ts       # env-driven configuration
  storage.ts      # local data cache under ~/.mm/data
  fetchers/       # transactions, budgets, cashflow, recurring
  alerts/         # alert rules + dedup
  reports/        # daily digest, weekly summary
  email/          # nodemailer sender + HTML templates
  warehouse/      # local SQLite warehouse (schema + queries)
scripts/          # runnable entry points
```

## Security & privacy

- Credentials live only in `.env` (gitignored) — nothing is hardcoded.
- Session tokens and cached account data are stored under `~/.mm/` with
  restrictive permissions, never in the repo.

## License

MIT
