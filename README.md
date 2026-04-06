# zatyrani.pl

Source code of website https://www.zatyrani.pl/

## Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## Scripts

All scripts require a `.env.local` file with `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set.

### Payments report (`scripts/payments-report.js`)

Shows paid amounts per event and lets you look up any payment by its ID (the UUID that SIBS receives as `merchantTransactionId`).

```bash
# Summary of all events
npm run payments:report

# Filter to one event
npm run payments:report -- --event niebocross-2026
npm run payments:report -- --event wilczypolmaraton-2026

# Look up a specific payment ID
npm run payments:report -- --id <uuid>
```

### Email campaign (`scripts/send-campaign.js`)

Sends a custom email campaign to NieboCross registrations. Edit `CAMPAIGN_ID`, `SUBJECT`, `DAILY_LIMIT` and `HTML_MESSAGE` inside the file before running.

```bash
npm run campaign:send
```

State is saved in `scripts/.campaign-state.json` (gitignored). Changing `CAMPAIGN_ID` resets state and starts a fresh run.