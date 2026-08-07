// Builds a UPI deep link (upi://pay) that pre-fills the amount and puts the
// order number in the transaction note, so the owner can match payments to
// orders even before the customer uploads a screenshot.
export function buildUpiLink(params: {
  amount: number;
  orderNumber: string;
}): string {
  const vpa = process.env.OWNER_UPI_VPA!;
  const name = process.env.OWNER_UPI_NAME!;
  const query = new URLSearchParams({
    pa: vpa,
    pn: name,
    am: params.amount.toFixed(2),
    cu: "INR",
    tn: `Order ${params.orderNumber}`,
  });
  return `upi://pay?${query.toString()}`;
}
