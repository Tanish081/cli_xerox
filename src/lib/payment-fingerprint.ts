import { createHash } from "crypto";

// Identifies a specific payment so the same screenshot can't be reused to
// verify more than one order. Prefers the OCR-extracted transaction ID
// (a real UPI app never issues the same one twice); falls back to a hash
// of the image bytes when no ID was readable, which still blocks the exact
// same screenshot file from being reused, if not a re-compressed copy of it.
export function computePaymentFingerprint(utr: string | null, imageBuffer: Buffer): string {
  if (utr) return `utr:${utr}`;
  return `img:${createHash("sha256").update(imageBuffer).digest("hex")}`;
}
