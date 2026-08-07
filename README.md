# Xerox & Stationery

A single-shop print/stationery ordering app. See [CLAUDE.md](./CLAUDE.md) for the
full project spec (data model, flows, rules).

## Setup

1. Create a Supabase project.
2. Run the SQL in `supabase/migrations/0001_init.sql` and `0002_storage.sql`
   against it (Supabase SQL editor, or `supabase db push` if using the CLI).
3. Create one admin user under Authentication → Users (email + password) —
   this is the only account in the system, used to sign in at `/admin/login`.
4. Copy `.env.local.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
     `SUPABASE_SERVICE_ROLE_KEY` from Supabase project settings → API
   - `OWNER_UPI_VPA`, `OWNER_UPI_NAME` for the checkout QR code
   - `CRON_SECRET` — any random string; Vercel Cron sends it automatically
     as a bearer token when this env var is set, so `/api/cron/cleanup`
     only runs for real cron requests
5. Add a few rows to `stationery_products` so the catalog isn't empty.
6. `npm run dev` and open http://localhost:3000.

## Customer flow

- `/` → `/order/new` (upload a document and/or add stationery, enter phone) →
  `/checkout?id=<order_number>` (UPI QR, upload payment screenshot + UTR) →
  `/order?id=<order_number>` (polls status; cookie-gated to this browser).
- Returning without the cookie: `/lookup` (order number + phone, rate-limited).

## Admin flow

- `/admin/login` → `/admin`: review queue (approve/reject), token-assigned
  queue (mark ready), ready queue (mark completed).

## Cleanup

`vercel.json` schedules `/api/cron/cleanup` daily. It strips
`document_url`/`payment_screenshot_url` (and the underlying Storage objects)
for any order whose `expires_at` has passed, per the 48-hour retention rule.
