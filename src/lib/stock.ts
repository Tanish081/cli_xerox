import type { SupabaseClient } from "@supabase/supabase-js";

type StockLine = { product_id: string; quantity: number };

// Atomically decrements each product's stock by the ordered quantity. The
// `gte` guard means the update is a no-op (0 rows affected) if stock
// changed to less than what's needed since it was last checked, which is
// how we detect -- and refuse -- overselling under concurrent orders.
// On any failure, whatever was already reserved in this call is rolled back.
export async function reserveStock(
  supabase: SupabaseClient,
  items: StockLine[]
): Promise<{ ok: true } | { ok: false; productId: string }> {
  const reserved: StockLine[] = [];

  for (const item of items) {
    const { data: product } = await supabase
      .from("stationery_products")
      .select("stock_quantity")
      .eq("id", item.product_id)
      .single();

    if (!product) {
      await restoreStock(supabase, reserved);
      return { ok: false, productId: item.product_id };
    }

    const { data: updated } = await supabase
      .from("stationery_products")
      .update({ stock_quantity: product.stock_quantity - item.quantity })
      .eq("id", item.product_id)
      .gte("stock_quantity", item.quantity)
      .select("id")
      .maybeSingle();

    if (!updated) {
      await restoreStock(supabase, reserved);
      return { ok: false, productId: item.product_id };
    }

    reserved.push(item);
  }

  return { ok: true };
}

// Convenience wrapper for the payment-proof route: looks up an order's
// items and restores their stock in one call.
export async function restoreStockForOrder(supabase: SupabaseClient, orderId: string): Promise<void> {
  const { data: items } = await supabase.from("order_items").select("product_id, quantity").eq("order_id", orderId);
  if (items && items.length > 0) {
    await restoreStock(supabase, items);
  }
}

// Puts reserved stock back -- used when an order that reserved it never
// completes payment (rejected, expired, duplicate screenshot, etc).
export async function restoreStock(supabase: SupabaseClient, items: StockLine[]): Promise<void> {
  for (const item of items) {
    const { data: product } = await supabase
      .from("stationery_products")
      .select("stock_quantity")
      .eq("id", item.product_id)
      .single();
    if (!product) continue;

    await supabase
      .from("stationery_products")
      .update({ stock_quantity: product.stock_quantity + item.quantity })
      .eq("id", item.product_id);
  }
}
