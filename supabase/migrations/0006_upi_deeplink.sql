-- The QR the owner uploads is just a photo, which is unusable on mobile:
-- a customer paying from their phone can't scan a QR displayed on that same
-- phone. Storing the UPI payload encoded inside that QR lets the checkout
-- page offer a tap-to-pay deep link that opens the customer's UPI app
-- directly. Decoded from the uploaded image at upload time (see
-- /admin/settings), so the owner has nothing extra to configure.
alter table shop_settings add column upi_payload text;
