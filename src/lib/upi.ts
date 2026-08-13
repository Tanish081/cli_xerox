// A UPI QR encodes a "upi://pay?pa=...&pn=..." string. The owner's uploaded
// QR is static, so it carries no amount -- the customer would have to type
// it themselves, which is both friction and a common cause of failed
// verification (a typo means the OCR'd amount won't match the order).
// Re-emitting the same payload with the order's amount attached makes the
// UPI app pre-fill it instead.
export function buildUpiDeepLink(payload: string, amount: number, orderNumber: string): string | null {
  if (!isUpiPayload(payload)) return null;

  try {
    // The scheme is not hierarchical (no "//" host part), so URL parsing of
    // "upi://pay?..." is inconsistent across runtimes -- split the query off
    // by hand instead.
    const queryStart = payload.indexOf("?");
    const base = queryStart === -1 ? payload : payload.slice(0, queryStart);
    const params = new URLSearchParams(queryStart === -1 ? "" : payload.slice(queryStart + 1));

    if (!params.get("pa")) return null; // no payee address -> nothing to pay to

    // Preserve whatever else the original QR carried (pn, aid, mc, ...) and
    // only set the transaction-specific fields.
    params.set("am", amount.toFixed(2));
    params.set("cu", "INR");
    params.set("tn", `Order ${orderNumber}`);

    // URLSearchParams serializes in form-encoding, which UPI apps don't
    // reliably accept: spaces become "+" (many parsers read that as a
    // literal plus, mangling the payee name) and "@" becomes "%40" (a
    // parser that doesn't decode would then look up a VPA that doesn't
    // exist). Real UPI QRs use %20 and a bare @, so emit that.
    const query = params.toString().replace(/\+/g, "%20").replace(/%40/g, "@");
    return `${base}?${query}`;
  } catch {
    return null;
  }
}

export function isUpiPayload(payload: string): boolean {
  return /^upi:\/\//i.test(payload.trim()) && /[?&]pa=[^&]+/i.test(payload);
}
