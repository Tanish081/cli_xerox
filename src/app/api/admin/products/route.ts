import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/admin-auth";
import { uploadPublicFile, PRODUCT_IMAGES_BUCKET, MAX_ADMIN_IMAGE_BYTES } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: products, error } = await supabase
    .from("stationery_products")
    .select("*")
    .order("name");

  if (error || !products) {
    return NextResponse.json({ error: "Could not load products" }, { status: 500 });
  }

  return NextResponse.json({ products });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const name = formData.get("name");
  const price = Number(formData.get("price"));
  const stockQuantity = Number(formData.get("stock_quantity"));
  const image = formData.get("image");

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: "A valid price is required" }, { status: 400 });
  }
  if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
    return NextResponse.json({ error: "A valid stock quantity is required" }, { status: 400 });
  }

  if (image instanceof File && image.size > MAX_ADMIN_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image is too large (max 8MB)" }, { status: 400 });
  }

  const supabase = createServiceClient();

  let imageUrl: string | null = null;
  if (image instanceof File && image.size > 0) {
    try {
      imageUrl = await uploadPublicFile(supabase, PRODUCT_IMAGES_BUCKET, image);
    } catch {
      return NextResponse.json({ error: "Could not upload product image" }, { status: 500 });
    }
  }

  const { data: product, error } = await supabase
    .from("stationery_products")
    .insert({ name: name.trim(), price, stock_quantity: stockQuantity, image_url: imageUrl, active: true })
    .select()
    .single();

  if (error || !product) {
    return NextResponse.json({ error: "Could not create product" }, { status: 500 });
  }

  return NextResponse.json({ product });
}
