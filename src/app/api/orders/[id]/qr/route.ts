import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { hasOrderSession } from "@/lib/order-session";
import { signedUrl } from "@/lib/storage";
import { getShopSettings, SHOP_ASSETS_BUCKET } from "@/lib/shop-settings";
import { PAYMENT_WINDOW_MS } from "@/lib/payment-window";
import { buildUpiDeepLink } from "@/lib/upi";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderNumber } = await params;
  const supabase = createServiceClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, total_amount, status, created_at")
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const authorized = await hasOrderSession(order.id);
  if (!authorized) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const settings = await getShopSettings(supabase);
  if (!settings?.qr_image_path) {
    return NextResponse.json({ error: "The shop hasn't set up payments yet" }, { status: 503 });
  }

  const qrImageUrl = await signedUrl(supabase, SHOP_ASSETS_BUCKET, settings.qr_image_path);
  const paymentDeadline = new Date(new Date(order.created_at).getTime() + PAYMENT_WINDOW_MS).toISOString();

  return NextResponse.json({
    qr_image_url: qrImageUrl,
    amount: order.total_amount,
    shop_name: settings.shop_name,
    payment_deadline: paymentDeadline,
    upi_link: settings.upi_payload
      ? buildUpiDeepLink(settings.upi_payload, order.total_amount, orderNumber)
      : null,
  });
}
