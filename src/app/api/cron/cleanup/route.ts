import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { DOCUMENTS_BUCKET, SCREENSHOTS_BUCKET } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Runs once a day via Vercel Cron (see vercel.json). Strips files for any
// order past its 48-hour post-completion expiry window; the order row
// itself is kept for sales records.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: expiredOrders, error } = await supabase
    .from("orders")
    .select("id, document_url, payment_screenshot_url")
    .lt("expires_at", new Date().toISOString())
    .or("document_url.not.is.null,payment_screenshot_url.not.is.null");

  if (error) {
    return NextResponse.json({ error: "Could not query expired orders" }, { status: 500 });
  }

  let cleaned = 0;
  for (const order of expiredOrders ?? []) {
    if (order.document_url) {
      await supabase.storage.from(DOCUMENTS_BUCKET).remove([order.document_url]);
    }
    if (order.payment_screenshot_url) {
      await supabase.storage.from(SCREENSHOTS_BUCKET).remove([order.payment_screenshot_url]);
    }
    await supabase
      .from("orders")
      .update({ document_url: null, payment_screenshot_url: null })
      .eq("id", order.id);
    cleaned++;
  }

  return NextResponse.json({ ok: true, cleaned });
}
