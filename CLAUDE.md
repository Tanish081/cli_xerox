@AGENTS.md

# Xerox & stationery shop app — project spec

A web app for a single xerox/print shop in India. Customers upload documents for
printing, add stationery items to a cart, pay via the owner's UPI QR code, and
upload a payment screenshot + UTR for manual approval. Once the owner approves,
the order gets a token number and a ready-by estimate. No customer accounts —
tracking works via a same-session view right after booking, or an order ID +
phone number lookup afterward.

## Tech stack

- **Next.js 14+ (App Router), TypeScript**
- **Supabase**: Postgres (database), Storage (uploaded documents + payment
  screenshots), Auth (used only for the single shop-owner admin login —
  customers never authenticate)
- **Tailwind CSS** for styling
- Deploy target: Vercel (app) + Supabase (backend services)

## Core rules — do not deviate from these

1. **No customer accounts or login, ever.** Two access paths only:
   same-session view, and order ID + phone number lookup.
2. **Payment is QR-only.** No payment gateway integration. The owner's UPI QR
   is shown at checkout; the customer pays externally and uploads proof.
3. **Every order needs manual owner approval.** No auto-verification of
   payment. Status only moves to "verified" when the owner approves it in the
   admin dashboard.
4. **Order tracking expires 48 hours after completion.** After that, the
   lookup returns "not found," and the uploaded document + screenshot are
   deleted from storage.
5. **All customer-facing Supabase access goes through Next.js server API
   routes**, using the Supabase **service role key** (server-only, never sent
   to the client). Enable RLS with default-deny policies on every table —
   there is no direct client-to-Supabase access for customer flows, since the
   phone-matching and rate-limiting logic needs to live in application code.

## Data model

```sql
orders
  id                    uuid primary key default gen_random_uuid()
  order_number          text unique not null      -- short, human-readable, e.g. "A214"
  phone_number          text not null              -- used at checkout + later lookup
  status                text not null default 'pending_payment'
                        -- pending_payment | pending_review | verified | rejected
                        -- | token_assigned | ready | completed
  print_spec            jsonb                      -- { copies, color, duplex, binding, page_count }
  document_url          text                       -- path in Supabase Storage
  total_amount          numeric not null
  payment_screenshot_url text
  payment_utr           text
  token_number           int
  estimated_ready_at     timestamptz
  completed_at            timestamptz
  expires_at               timestamptz             -- = completed_at + 48h, set on completion
  created_at              timestamptz default now()

order_items
  id           uuid primary key default gen_random_uuid()
  order_id     uuid references orders(id) on delete cascade
  product_id   uuid references stationery_products(id)
  quantity     int not null
  unit_price   numeric not null

stationery_products
  id              uuid primary key default gen_random_uuid()
  name            text not null
  price           numeric not null
  stock_quantity  int not null default 0
  image_url       text
  active          boolean default true

lookup_attempts                        -- for rate limiting the phone+ID lookup
  id           uuid primary key default gen_random_uuid()
  identifier   text not null            -- phone number or IP, whichever is stricter
  attempted_at timestamptz default now()
```

## Same-session tracking (no token, no login)

When an order is created, set a short-lived **httpOnly session cookie**
scoped to that order (e.g. `order_session=<order_id>`), invisible to the
customer. The confirmation page reads the order ID from the URL query param
(`/order?id=A214`) and polls `GET /api/orders/:id` every 15–20 seconds.

That endpoint should only return full order details if:
- the request carries a valid session cookie for that specific order, **or**
- the request came through the phone + order ID lookup flow (below)

This keeps the experience exactly as designed (no visible login, no token in
the URL) while avoiding a fully public endpoint that anyone could hit just by
guessing a sequential order number.

## Phone + order ID lookup (the return path)

`POST /api/orders/lookup` — body: `{ order_number, phone_number }`

- Look up the order by `order_number`, check `phone_number` matches
- Check `expires_at` — if past, respond as if the order doesn't exist
- **Rate limit** before querying: check the `lookup_attempts` table for the
  submitting phone number and IP; if more than ~5 attempts in the last 15
  minutes, reject with a generic "too many attempts, try again later"
- Log every attempt (success or failure) to `lookup_attempts`

## Admin dashboard

- Single login via Supabase Auth (email + password is enough — one owner
  account, no roles/permissions system needed)
- Queue view: orders with `status = pending_review`, showing the screenshot,
  UTR, and order total
- Approve → sets `status = token_assigned`, generates the next `token_number`,
  sets `estimated_ready_at`
- Reject → sets `status = rejected`, order becomes re-editable by the customer
  on their same-session page (let them re-upload proof)
- Mark ready / mark completed buttons that update `status` and, on
  completion, set `completed_at` and `expires_at = completed_at + interval '48 hours'`

## Cleanup job

A scheduled job (Vercel Cron calling a Next.js API route once a day is
simplest, since it can also touch Supabase Storage — `pg_cron` alone can't
delete storage objects):

1. Find orders where `expires_at < now()`
2. Delete their `document_url` and `payment_screenshot_url` objects from
   Supabase Storage using the service role key
3. Null out those columns on the order row (keep the row for your own sales
   records, just strip the files)

## Build order (do these as separate, focused sessions)

1. **Project setup** — Next.js + Tailwind + Supabase client, schema migration
   for the tables above, RLS enabled with default-deny policies
2. **Ordering flow** — document upload to Supabase Storage, print options +
   pricing, stationery catalog + cart
3. **QR payment + proof upload** — checkout page showing the owner's UPI QR
   (ideally a deep link encoding amount + order number as the note), proof
   upload form (screenshot + UTR), writes order with `status = pending_review`
4. **Same-session tracking page** — cookie-gated `/order?id=` page with
   polling status timeline
5. **Admin dashboard** — Supabase Auth login, approval queue, approve/reject,
   token assignment
6. **Lookup + cleanup** — rate-limited phone+ID lookup endpoint, daily cron
   job for expiry and file deletion

## Explicitly out of scope for now

- Payment gateway integration (QR + manual approval only)
- Customer accounts or any form of customer login
- Automated WhatsApp/SMS notifications (owner sends these manually if at all)
- Multi-branch or multi-vendor support

## Environment variables needed

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=       # used only for admin Auth on the client
SUPABASE_SERVICE_ROLE_KEY=            # server-only, never exposed to client
OWNER_UPI_VPA=
OWNER_UPI_NAME=
```
