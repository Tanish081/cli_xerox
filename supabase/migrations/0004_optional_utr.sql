-- The transaction ID can no longer be a hard requirement for verification
-- (GPay's default confirmation screenshot never shows one, only PhonePe
-- does), so it's now an optional signal rather than a mandatory field.
-- To close the anti-replay hole this opens (a customer reusing the same
-- screenshot across multiple orders), every verified payment is fingerprinted
-- (the UTR when OCR found one, otherwise a hash of the screenshot image) and
-- that fingerprint must be unique across orders.

alter table orders add column payment_fingerprint text;

create unique index orders_payment_fingerprint_idx
  on orders (payment_fingerprint)
  where payment_fingerprint is not null;
