import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("stationery_products")
    .select("id, name, price, stock_quantity, image_url, active")
    .eq("active", true)
    .order("name");

  if (error) {
    return NextResponse.json({ error: "Could not load products" }, { status: 500 });
  }

  return NextResponse.json({ products: data });
}
