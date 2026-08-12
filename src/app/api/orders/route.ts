import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateOrderNumber } from "@/lib/order-number";
import { priceForPrintSpec } from "@/lib/pricing";
import { uploadOrderFile, DOCUMENTS_BUCKET, MAX_DOCUMENT_BYTES } from "@/lib/storage";
import { grantOrderSession } from "@/lib/order-session";
import { reserveStock } from "@/lib/stock";
import type { PrintSpec, CartLine } from "@/lib/types";

export const dynamic = "force-dynamic";

function isPrintSpec(value: unknown): value is PrintSpec {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.copies === "number" &&
    v.copies > 0 &&
    (v.color === "bw" || v.color === "color") &&
    typeof v.duplex === "boolean" &&
    (v.binding === "none" || v.binding === "staple" || v.binding === "spiral") &&
    typeof v.page_count === "number" &&
    v.page_count > 0
  );
}

export async function POST(request: Request) {
  const formData = await request.formData();

  const phoneNumber = formData.get("phone_number");
  if (typeof phoneNumber !== "string" || !/^[0-9]{10}$/.test(phoneNumber)) {
    return NextResponse.json({ error: "Valid 10-digit phone number is required" }, { status: 400 });
  }

  let printSpec: PrintSpec | null = null;
  const printSpecRaw = formData.get("print_spec");
  if (typeof printSpecRaw === "string" && printSpecRaw.length > 0) {
    const parsed = JSON.parse(printSpecRaw);
    if (!isPrintSpec(parsed)) {
      return NextResponse.json({ error: "Invalid print specification" }, { status: 400 });
    }
    printSpec = parsed;
  }

  const documentFile = formData.get("document");
  if (printSpec && !(documentFile instanceof File)) {
    return NextResponse.json({ error: "A document is required for a print job" }, { status: 400 });
  }
  if (documentFile instanceof File && documentFile.size > MAX_DOCUMENT_BYTES) {
    return NextResponse.json({ error: "Document is too large (max 20MB)" }, { status: 400 });
  }

  let cart: CartLine[] = [];
  const cartRaw = formData.get("cart");
  if (typeof cartRaw === "string" && cartRaw.length > 0) {
    const parsed = JSON.parse(cartRaw);
    if (
      !Array.isArray(parsed) ||
      !parsed.every(
        (line) =>
          line &&
          typeof line.product_id === "string" &&
          typeof line.quantity === "number" &&
          line.quantity > 0
      )
    ) {
      return NextResponse.json({ error: "Invalid cart" }, { status: 400 });
    }
    cart = parsed;
  }

  if (!printSpec && cart.length === 0) {
    return NextResponse.json({ error: "Order must include a print job or cart items" }, { status: 400 });
  }

  const supabase = createServiceClient();

  let total = printSpec ? priceForPrintSpec(printSpec) : 0;
  const orderItems: { product_id: string; quantity: number; unit_price: number }[] = [];

  if (cart.length > 0) {
    const productIds = cart.map((line) => line.product_id);
    const { data: products, error: productsError } = await supabase
      .from("stationery_products")
      .select("id, price, stock_quantity, active")
      .in("id", productIds);

    if (productsError || !products) {
      return NextResponse.json({ error: "Could not load cart products" }, { status: 500 });
    }

    for (const line of cart) {
      const product = products.find((p) => p.id === line.product_id);
      if (!product || !product.active) {
        return NextResponse.json({ error: "One of the items in your cart is no longer available" }, { status: 400 });
      }
      if (product.stock_quantity < line.quantity) {
        return NextResponse.json({ error: "One of the items in your cart is out of stock" }, { status: 400 });
      }
      orderItems.push({ product_id: product.id, quantity: line.quantity, unit_price: product.price });
      total += product.price * line.quantity;
    }
  }

  total = Math.round(total * 100) / 100;

  const orderNumber = await generateOrderNumber(supabase);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      phone_number: phoneNumber,
      status: "pending_payment",
      print_spec: printSpec,
      total_amount: total,
    })
    .select()
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: "Could not create order" }, { status: 500 });
  }

  if (documentFile instanceof File && documentFile.size > 0) {
    try {
      const path = await uploadOrderFile(supabase, DOCUMENTS_BUCKET, order.id, documentFile);
      await supabase.from("orders").update({ document_url: path }).eq("id", order.id);
    } catch {
      await supabase.from("orders").delete().eq("id", order.id);
      return NextResponse.json({ error: "Could not upload document" }, { status: 500 });
    }
  }

  if (orderItems.length > 0) {
    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems.map((item) => ({ ...item, order_id: order.id })));
    if (itemsError) {
      await supabase.from("orders").delete().eq("id", order.id);
      return NextResponse.json({ error: "Could not save cart items" }, { status: 500 });
    }

    const reservation = await reserveStock(supabase, orderItems);
    if (!reservation.ok) {
      await supabase.from("orders").delete().eq("id", order.id);
      return NextResponse.json({ error: "One of the items in your cart just sold out" }, { status: 400 });
    }
  }

  await grantOrderSession(order.id);

  return NextResponse.json({ id: order.id, order_number: order.order_number, total_amount: total });
}
