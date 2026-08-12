-- Owner-uploaded QR image + fully automated OCR payment verification.
-- Replaces the generated UPI deep-link QR and the manual owner-approval
-- step: the payment-proof route now decides token_assigned vs rejected
-- itself, so pending_review/verified are no longer reachable statuses.

create table shop_settings (
  id           smallint primary key default 1 check (id = 1),
  shop_name    text not null default '',
  qr_image_path text,
  updated_at   timestamptz not null default now()
);

alter table shop_settings enable row level security;

alter table orders
  add column ocr_extracted jsonb,
  add column verification_failure_reason text;

alter table orders drop constraint orders_status_check;
alter table orders add constraint orders_status_check
  check (status in (
    'pending_payment', 'rejected', 'token_assigned', 'ready', 'completed'
  ));

insert into storage.buckets (id, name, public)
values ('shop-assets', 'shop-assets', false)
on conflict (id) do nothing;
