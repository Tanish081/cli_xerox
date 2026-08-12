import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/admin-auth";
import { signedUrl, MAX_ADMIN_IMAGE_BYTES } from "@/lib/storage";
import { getShopSettings, SHOP_ASSETS_BUCKET } from "@/lib/shop-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const settings = await getShopSettings(supabase);

  return NextResponse.json({
    shop_name: settings?.shop_name ?? "",
    qr_image_url: settings?.qr_image_path
      ? await signedUrl(supabase, SHOP_ASSETS_BUCKET, settings.qr_image_path)
      : null,
  });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const shopName = formData.get("shop_name");
  const qrImage = formData.get("qr_image");

  if (typeof shopName !== "string" || !shopName.trim()) {
    return NextResponse.json({ error: "Shop name is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const update: { id: number; shop_name: string; qr_image_path?: string } = {
    id: 1,
    shop_name: shopName.trim(),
  };

  if (qrImage instanceof File && qrImage.size > MAX_ADMIN_IMAGE_BYTES) {
    return NextResponse.json({ error: "QR image is too large (max 8MB)" }, { status: 400 });
  }

  if (qrImage instanceof File && qrImage.size > 0) {
    const ext = qrImage.name.includes(".") ? qrImage.name.split(".").pop() : "png";
    const path = `qr.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(SHOP_ASSETS_BUCKET)
      .upload(path, qrImage, { contentType: qrImage.type, upsert: true });
    if (uploadError) {
      return NextResponse.json({ error: "Could not upload QR image" }, { status: 500 });
    }
    update.qr_image_path = path;
  }

  const { error: upsertError } = await supabase.from("shop_settings").upsert(update);
  if (upsertError) {
    return NextResponse.json({ error: "Could not save shop settings" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
