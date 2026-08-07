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
  if (order.status !== "pending_review") {
    return NextResponse.json({ error: "Order is not awaiting review" }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({ status: "rejected" })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: "Could not reject order" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
