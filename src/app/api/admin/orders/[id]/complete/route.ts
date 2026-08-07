import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createServiceClient();

  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.status !== "ready") {
    return NextResponse.json({ error: "Order is not marked ready yet" }, { status: 400 });
  }

  const completedAt = new Date();
  const expiresAt = new Date(completedAt.getTime() + 48 * 60 * 60 * 1000);

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      status: "completed",
      completed_at: completedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: "Could not mark order completed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
