import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isRateLimited, logAttempt, getClientIp } from "@/lib/rate-limit";
import { grantOrderSession } from "@/lib/order-session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const orderNumber = typeof body?.order_number === "string" ? body.order_number.trim().toUpperCase() : "";
  const phoneNumber = typeof body?.phone_number === "string" ? body.phone_number.trim() : "";

  if (!orderNumber || !/^[0-9]{10}$/.test(phoneNumber)) {
    return NextResponse.json({ error: "Order number and a valid phone number are required" }, { status: 400 });
  }

  const ip = getClientIp(request);
  const identifiers = [phoneNumber, ip];
  const supabase = createServiceClient();

  if (await isRateLimited(supabase, identifiers)) {
    return NextResponse.json({ error: "Too many attempts, try again later" }, { status: 429 });
  }

  await logAttempt(supabase, identifiers);

  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, phone_number, expires_at")
    .eq("order_number", orderNumber)
    .maybeSingle();

  const notFound = () => NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (!order || order.phone_number !== phoneNumber) {
    return notFound();
  }
  if (order.expires_at && new Date(order.expires_at) < new Date()) {
    return notFound();
  }

  // Grant the same session cookie a same-session customer would have, so
  // the returning customer lands on the normal cookie-gated tracking page.
  await grantOrderSession(order.id);

  return NextResponse.json({ order_number: order.order_number });
}
