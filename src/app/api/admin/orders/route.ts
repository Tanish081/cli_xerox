import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/admin-auth";
import { signedUrl, DOCUMENTS_BUCKET, SCREENSHOTS_BUCKET } from "@/lib/storage";

export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set([
  "pending_payment",
  "pending_review",
  "verified",
  "rejected",
  "token_assigned",
  "ready",
  "completed",
]);

export async function GET(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "pending_review";
  if (!VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: orders, error } = await supabase
    .from("orders")
    .select("*, order_items(*, product:stationery_products(*))")
    .eq("status", status)
    .order("created_at", { ascending: true });

  if (error || !orders) {
    return NextResponse.json({ error: "Could not load orders" }, { status: 500 });
  }

  const withUrls = await Promise.all(
    orders.map(async (order) => ({
      ...order,
      document_signed_url: order.document_url
        ? await signedUrl(supabase, DOCUMENTS_BUCKET, order.document_url)
        : null,
      payment_screenshot_signed_url: order.payment_screenshot_url
        ? await signedUrl(supabase, SCREENSHOTS_BUCKET, order.payment_screenshot_url)
        : null,
    }))
  );

  return NextResponse.json({ orders: withUrls });
}
