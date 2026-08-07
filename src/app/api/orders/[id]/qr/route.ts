import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { createServiceClient } from "@/lib/supabase/service";
import { hasOrderSession } from "@/lib/order-session";
import { buildUpiLink } from "@/lib/upi";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderNumber } = await params;
  const supabase = createServiceClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, total_amount, status")
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const authorized = await hasOrderSession(order.id);
  if (!authorized) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const upiLink = buildUpiLink({ amount: order.total_amount, orderNumber });
  const dataUrl = await QRCode.toDataURL(upiLink, { margin: 1, width: 320 });

  return NextResponse.json({ qr_data_url: dataUrl, upi_link: upiLink, amount: order.total_amount });
}
