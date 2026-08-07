import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// Assigns the next token number for the day (tokens reset daily) and an
// estimated ready time, then moves the order into the customer-visible
// "token_assigned" state.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const readyInMinutes = typeof body?.ready_in_minutes === "number" && body.ready_in_minutes > 0 ? body.ready_in_minutes : 30;

  const supabase = createServiceClient();

  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.status !== "pending_review") {
    return NextResponse.json({ error: "Order is not awaiting review" }, { status: 400 });
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data: lastToken } = await supabase
    .from("orders")
    .select("token_number")
    .not("token_number", "is", null)
    .gte("created_at", startOfDay.toISOString())
    .order("token_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const tokenNumber = (lastToken?.token_number ?? 0) + 1;
  const estimatedReadyAt = new Date(Date.now() + readyInMinutes * 60 * 1000).toISOString();

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      status: "token_assigned",
      token_number: tokenNumber,
      estimated_ready_at: estimatedReadyAt,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: "Could not approve order" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, token_number: tokenNumber, estimated_ready_at: estimatedReadyAt });
}
