import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { hasOrderSession } from "@/lib/order-session";
import { signedUrl, DOCUMENTS_BUCKET, SCREENSHOTS_BUCKET } from "@/lib/storage";

export const dynamic = "force-dynamic";

// :id here is the human-readable order_number shown in the URL
// (/order?id=A214), not the internal uuid. Access requires the httpOnly
// session cookie granted at order creation — there is no other way to
// reach this endpoint (the phone+ID lookup flow uses a separate endpoint).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderNumber } = await params;
  const supabase = createServiceClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select("*, order_items(*, product:stationery_products(*))")
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const authorized = await hasOrderSession(order.id);
  if (!authorized) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  if (order.expires_at && new Date(order.expires_at) < new Date()) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const document_signed_url = order.document_url
    ? await signedUrl(supabase, DOCUMENTS_BUCKET, order.document_url)
    : null;
  const payment_screenshot_signed_url = order.payment_screenshot_url
    ? await signedUrl(supabase, SCREENSHOTS_BUCKET, order.payment_screenshot_url)
    : null;

  return NextResponse.json({
    order: { ...order, document_signed_url, payment_screenshot_signed_url },
  });
}
