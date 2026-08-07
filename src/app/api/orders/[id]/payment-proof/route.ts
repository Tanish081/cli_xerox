import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { hasOrderSession } from "@/lib/order-session";
import { uploadOrderFile, SCREENSHOTS_BUCKET } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Accepts the payment screenshot + UTR and moves the order into the
// owner's review queue. Also used to re-submit proof after a rejection.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderNumber } = await params;
  const supabase = createServiceClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, status")
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const authorized = await hasOrderSession(order.id);
  if (!authorized) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  if (order.status !== "pending_payment" && order.status !== "rejected") {
    return NextResponse.json({ error: "This order is not awaiting payment proof" }, { status: 400 });
  }

  const formData = await request.formData();
  const screenshot = formData.get("screenshot");
  const utr = formData.get("utr");

  if (!(screenshot instanceof File) || screenshot.size === 0) {
    return NextResponse.json({ error: "A payment screenshot is required" }, { status: 400 });
  }
  if (typeof utr !== "string" || utr.trim().length < 4) {
    return NextResponse.json({ error: "A valid UTR / transaction reference is required" }, { status: 400 });
  }

  const path = await uploadOrderFile(supabase, SCREENSHOTS_BUCKET, order.id, screenshot);

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      payment_screenshot_url: path,
      payment_utr: utr.trim(),
      status: "pending_review",
    })
    .eq("id", order.id);

  if (updateError) {
    return NextResponse.json({ error: "Could not submit payment proof" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
