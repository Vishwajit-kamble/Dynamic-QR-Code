# QR Studio — Dynamic Google Review Cards

Manage, pre-print, assign, and track dynamic QR codes with instant destination switching and scan analytics.

## Features

- **Pre-Print Inventory Workflow**: Batch-create up to 50 unlinked Google Review cards at a time (`Batch cards`), print high-error-correction QR labels or download vector `.svg` / 1024px `.png` files, and link each card to a buyer's Google Review link after sale without reprinting.
- **Instant Redirect Updates**: `/r/<code>` responses carry `no-store` browser and CDN headers so destination edits apply immediately on the next phone scan worldwide.
- **Analytics Dashboard**: 7d / 30d / 90d scan charts, device breakdown (mobile/desktop/tablet), top-performing cards, referral sources, and Card ID search/filtering.
- **Zero-Config Local Mode + Cloud Postgres Production Mode**: Runs against `.data/qr-workspace.json` locally (with automatic Wi-Fi LAN IP encoding for testing from a phone) and switches automatically to PostgreSQL (`DATABASE_URL`) when deployed to Vercel.
- **Optional Admin Passcode Lock**: Set `ADMIN_PASSCODE` in production to protect dashboard management routes while keeping public `/r/<code>` scan links active 24/7.

## Local Development (Bun)

```sh
bun install
bun run dev
```

## Deploying to Vercel + Cloud Postgres

1. Import this repository on [Vercel](https://vercel.com/new) (`vercel.json` is pre-configured for Bun).
2. Connect a PostgreSQL database (such as **Neon** or **Supabase Postgres** from the Vercel Storage Marketplace) so `DATABASE_URL` is configured.
3. Add `ADMIN_PASSCODE` under **Settings -> Environment Variables** to protect your workspace.
4. Redeploy and verify `/api/health` returns `{"ok":true,"storageMode":"postgres"}` before bulk-printing physical cards.
