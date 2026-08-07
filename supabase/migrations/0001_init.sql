-- Xerox shop schema. All customer-facing access goes through Next.js API
-- routes using the service-role key, which bypasses RLS. RLS is enabled
-- with default-deny (no policies) on every table so direct client access
-- via the anon key is impossible; the only anon-key usage in this app is
-- Supabase Auth for the single admin account.

create extension if not exists pgcrypto;

create table stationery_products (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  price          numeric not null,
  stock_quantity int not null default 0,
  image_url      text,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

create table orders (
  id                      uuid primary key default gen_random_uuid(),
  order_number            text unique not null,
  phone_number            text not null,
  status                  text not null default 'pending_payment'
                          check (status in (
                            'pending_payment', 'pending_review', 'verified',
                            'rejected', 'token_assigned', 'ready', 'completed'
                          )),
  print_spec              jsonb,
  document_url            text,
  total_amount            numeric not null,
  payment_screenshot_url  text,
  payment_utr             text,
  token_number            int,
  estimated_ready_at      timestamptz,
  completed_at            timestamptz,
  expires_at              timestamptz,
  created_at              timestamptz not null default now()
);

create index orders_order_number_idx on orders (order_number);
create index orders_status_idx on orders (status);
create index orders_expires_at_idx on orders (expires_at);

create table order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders(id) on delete cascade,
  product_id uuid references stationery_products(id),
  quantity   int not null,
  unit_price numeric not null
);

create index order_items_order_id_idx on order_items (order_id);

create table lookup_attempts (
  id           uuid primary key default gen_random_uuid(),
  identifier   text not null,
  attempted_at timestamptz not null default now()
);

create index lookup_attempts_identifier_idx on lookup_attempts (identifier, attempted_at);

-- Default-deny RLS: enable on every table, add zero policies. Only the
-- service-role key (which bypasses RLS entirely) can read/write these
-- tables; the anon key used client-side for admin Auth gets nothing.
alter table stationery_products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table lookup_attempts enable row level security;
