import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/admin-auth";
import { startOfIstDayUtc, startOfIstMonthUtc } from "@/lib/ist-time";
import type { PrintSpec } from "@/lib/types";

export const dynamic = "force-dynamic";

// Orders that actually represent real, paid revenue -- pending_payment never
// completed a sale, rejected means verification failed and the order was
// cancelled outright (see CLAUDE.md rule #3).
const PAID_STATUSES = ["token_assigned", "ready", "completed"];

function printSpecLabel(spec: PrintSpec | null): string | null {
  if (!spec) return null;
  return `Print × ${spec.copies} (${spec.color === "bw" ? "B&W" : "Color"}, ${spec.page_count}pg)`;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const dayStart = startOfIstDayUtc();
  const monthStart = startOfIstMonthUtc();

  const [dailyResult, monthlyResult, ordersResult, allProductsResult] = await Promise.all([
    supabase.from("orders").select("total_amount").in("status", PAID_STATUSES).gte("created_at", dayStart.toISOString()),
    supabase
      .from("orders")
      .select("total_amount")
      .in("status", PAID_STATUSES)
      .gte("created_at", monthStart.toISOString()),
    supabase
      .from("orders")
      .select("order_number, phone_number, total_amount, created_at, print_spec, order_items(quantity, product:stationery_products(name))")
      .in("status", PAID_STATUSES)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase.from("stationery_products").select("id, name"),
  ]);

  const dailyRevenue = (dailyResult.data ?? []).reduce((sum, o) => sum + Number(o.total_amount), 0);
  const monthlyRevenue = (monthlyResult.data ?? []).reduce((sum, o) => sum + Number(o.total_amount), 0);

  // Quantity sold per product, across every paid order ever (not just the
  // 300-row page above, which exists only to keep the table a sane size).
  const salesByProduct = new Map<string, number>();
  for (const product of allProductsResult.data ?? []) {
    salesByProduct.set(product.id, 0);
  }
  const { data: allItems } = await supabase
    .from("order_items")
    .select("product_id, quantity, order:orders!inner(status)")
    .in("order.status", PAID_STATUSES);
  for (const item of allItems ?? []) {
    if (!item.product_id) continue;
    salesByProduct.set(item.product_id, (salesByProduct.get(item.product_id) ?? 0) + item.quantity);
  }
  const productNameById = new Map((allProductsResult.data ?? []).map((p) => [p.id, p.name]));
  const itemSales = Array.from(salesByProduct.entries())
    .map(([productId, quantity]) => ({ name: productNameById.get(productId) ?? "Unknown", quantity }))
    .sort((a, b) => b.quantity - a.quantity);

  const orders = (ordersResult.data ?? []).map((order, i) => {
    const items = (order.order_items ?? []) as unknown as { quantity: number; product: { name: string } | null }[];
    const parts = [printSpecLabel(order.print_spec as PrintSpec | null), ...items.map((it) => `${it.product?.name ?? "Item"} × ${it.quantity}`)].filter(
      Boolean
    );
    return {
      serial: i + 1,
      order_number: order.order_number,
      phone_number: order.phone_number,
      details: parts.join(", ") || "—",
      total_amount: order.total_amount,
      created_at: order.created_at,
    };
  });

  return NextResponse.json({
    daily_revenue: dailyRevenue,
    monthly_revenue: monthlyRevenue,
    top_items: itemSales.slice(0, 5),
    least_items: [...itemSales].reverse().slice(0, 5),
    orders,
  });
}
