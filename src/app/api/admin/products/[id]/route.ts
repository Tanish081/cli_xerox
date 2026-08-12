import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/admin-auth";
import { uploadPublicFile, PRODUCT_IMAGES_BUCKET, MAX_ADMIN_IMAGE_BYTES } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const formData = await request.formData();
  const supabase = createServiceClient();

  const update: Record<string, unknown> = {};

  const name = formData.get("name");
  if (typeof name === "string" && name.trim()) update.name = name.trim();

  const priceRaw = formData.get("price");
  if (priceRaw !== null) {
    const price = Number(priceRaw);
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: "A valid price is required" }, { status: 400 });
    }
    update.price = price;
  }

  const stockRaw = formData.get("stock_quantity");
  if (stockRaw !== null) {
    const stock = Number(stockRaw);
    if (!Number.isInteger(stock) || stock < 0) {
      return NextResponse.json({ error: "A valid stock quantity is required" }, { status: 400 });
    }
    update.stock_quantity = stock;
  }

  const activeRaw = formData.get("active");
  if (activeRaw !== null) update.active = activeRaw === "true";

  const image = formData.get("image");
  if (image instanceof File && image.size > MAX_ADMIN_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image is too large (max 8MB)" }, { status: 400 });
  }
  if (image instanceof File && image.size > 0) {
    try {
      update.image_url = await uploadPublicFile(supabase, PRODUCT_IMAGES_BUCKET, image);
    } catch {
      return NextResponse.json({ error: "Could not upload product image" }, { status: 500 });
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data: product, error } = await supabase
    .from("stationery_products")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error || !product) {
    return NextResponse.json({ error: "Could not update product" }, { status: 500 });
  }

  return NextResponse.json({ product });
}
