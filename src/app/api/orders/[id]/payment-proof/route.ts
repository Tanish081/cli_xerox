import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { hasOrderSession } from "@/lib/order-session";
import { uploadOrderFile, SCREENSHOTS_BUCKET, MAX_SCREENSHOT_BYTES } from "@/lib/storage";
import { getShopSettings } from "@/lib/shop-settings";
import { runOcr, verifyPayment } from "@/lib/ocr";
import { assignToken } from "@/lib/token";
import { computePaymentFingerprint } from "@/lib/payment-fingerprint";
import { restoreStockForOrder } from "@/lib/stock";
import { PAYMENT_WINDOW_MS } from "@/lib/payment-window";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Accepts the payment screenshot, runs OCR against it, and immediately
// decides the order's fate: token_assigned on a match, rejected (order
// cancelled, no retry) on any failure — no owner review step.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderNumber } = await params;
  const supabase = createServiceClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, status, created_at, total_amount")
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const authorized = await hasOrderSession(order.id);
  if (!authorized) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  if (order.status !== "pending_payment") {
    return NextResponse.json({ error: "This order is not awaiting payment proof" }, { status: 400 });
  }

  const createdAt = new Date(order.created_at);
  const windowEnd = new Date(createdAt.getTime() + PAYMENT_WINDOW_MS);

  if (Date.now() > windowEnd.getTime()) {
    await supabase
      .from("orders")
      .update({ status: "rejected", verification_failure_reason: "expired" })
      .eq("id", order.id);
    await restoreStockForOrder(supabase, order.id);
    return NextResponse.json({ ok: false, reason: "expired" });
  }

  const formData = await request.formData();
  const screenshot = formData.get("screenshot");

  if (!(screenshot instanceof File) || screenshot.size === 0) {
    return NextResponse.json({ error: "A payment screenshot is required" }, { status: 400 });
  }
  if (screenshot.size > MAX_SCREENSHOT_BYTES) {
    return NextResponse.json({ error: "Screenshot is too large (max 10MB)" }, { status: 400 });
  }

  const path = await uploadOrderFile(supabase, SCREENSHOTS_BUCKET, order.id, screenshot);

  const settings = await getShopSettings(supabase);
  const buffer = Buffer.from(await screenshot.arrayBuffer());

  // A corrupt file, an unsupported format, or anything else that isn't a
  // decodable image throws inside Tesseract rather than returning empty
  // text -- that must fail the order cleanly (same as any other
  // unreadable screenshot) instead of crashing the request.
  let text: string;
  try {
    text = await runOcr(buffer);
  } catch {
    text = "";
  }

  const result = verifyPayment({
    text,
    expectedAmount: order.total_amount,
    expectedShopName: settings?.shop_name ?? "",
    windowStart: createdAt,
    windowEnd,
  });

  if (!result.ok) {
    await supabase
      .from("orders")
      .update({
        status: "rejected",
        payment_screenshot_url: path,
        ocr_extracted: result.extracted,
        verification_failure_reason: result.reason,
      })
      .eq("id", order.id);
    await restoreStockForOrder(supabase, order.id);
    return NextResponse.json({ ok: false, reason: result.reason });
  }

  const fingerprint = computePaymentFingerprint(result.extracted.utr, buffer);

  const { data: existingUse } = await supabase
    .from("orders")
    .select("id")
    .eq("payment_fingerprint", fingerprint)
    .maybeSingle();

  if (existingUse) {
    await supabase
      .from("orders")
      .update({
        status: "rejected",
        payment_screenshot_url: path,
        ocr_extracted: result.extracted,
        verification_failure_reason: "duplicate_payment",
      })
      .eq("id", order.id);
    await restoreStockForOrder(supabase, order.id);
    return NextResponse.json({ ok: false, reason: "duplicate_payment" });
  }

  const { token_number, estimated_ready_at } = await assignToken(supabase);

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      status: "token_assigned",
      payment_screenshot_url: path,
      payment_utr: result.extracted.utr,
      ocr_extracted: result.extracted,
      payment_fingerprint: fingerprint,
      token_number,
      estimated_ready_at,
    })
    .eq("id", order.id);

  if (updateError) {
    // Unique violation on payment_fingerprint means another request won
    // the race for the same payment between our check above and this write.
    const isDuplicate = (updateError as { code?: string }).code === "23505";
    await supabase
      .from("orders")
      .update({
        status: "rejected",
        verification_failure_reason: isDuplicate ? "duplicate_payment" : undefined,
      })
      .eq("id", order.id);
    await restoreStockForOrder(supabase, order.id);
    return NextResponse.json({
      ok: false,
      ...(isDuplicate ? { reason: "duplicate_payment" } : { error: "Could not finalize order" }),
    });
  }

  return NextResponse.json({ ok: true, token_number, estimated_ready_at });
}
