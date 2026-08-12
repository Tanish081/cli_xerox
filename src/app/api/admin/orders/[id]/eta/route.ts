import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// Lets the shopkeeper push an order's estimated-ready time out (or pull it
// in) relative to now -- e.g. "we're running 45 minutes behind" during a
// rush. The customer's tracking page picks this up on its next poll.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const minutesFromNow = Number(body?.minutes_from_now);

  if (!Number.isFinite(minutesFromNow) || minutesFromNow < 0) {
    return NextResponse.json({ error: "A valid number of minutes is required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const estimatedReadyAt = new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString();

  const { data: order, error } = await supabase
    .from("orders")
    .update({ estimated_ready_at: estimatedReadyAt })
    .eq("id", id)
    .select("id, estimated_ready_at")
    .maybeSingle();

  if (error || !order) {
    return NextResponse.json({ error: "Could not update estimated ready time" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, estimated_ready_at: order.estimated_ready_at });
}
