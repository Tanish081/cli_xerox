-- Public bucket for stationery product photos. These are plain catalog
-- images (not customer documents/screenshots), so unlike the other buckets
-- they're served via a public URL rather than a signed one -- no per-view
-- signing needed, and the customer catalog loads faster.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;
