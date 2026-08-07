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
  if (order.status !== "token_assigned") {
    return NextResponse.json({ error: "Order has not been assigned a token yet" }, { status: 400 });
  }

  const { error: updateError } = await supabase.from("orders").update({ status: "ready" }).eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: "Could not mark order ready" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
