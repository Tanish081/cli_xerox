import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/admin-auth";
import { signedUrl, MAX_ADMIN_IMAGE_BYTES } from "@/lib/storage";
import { getShopSettings, SHOP_ASSETS_BUCKET } from "@/lib/shop-settings";
import { isUpiPayload } from "@/lib/upi";

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
    // Only whether tap-to-pay is set up, not the payload itself.
    has_upi_link: Boolean(settings?.upi_payload),
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

  const update: { id: number; shop_name: string; qr_image_path?: string; upi_payload?: string | null } = {
    id: 1,
    shop_name: shopName.trim(),
  };

  // The browser decodes the uploaded QR and sends the UPI string it holds,
  // which becomes the customer's tap-to-pay link. Only stored alongside a
  // new image, so replacing the QR can never leave a stale link pointing at
  // a different payee than the QR on screen. Validated rather than trusted:
  // it ends up in an href on the customer's phone.
  const upiPayload = formData.get("upi_payload");
  if (qrImage instanceof File && qrImage.size > 0) {
    update.upi_payload =
      typeof upiPayload === "string" && isUpiPayload(upiPayload) ? upiPayload.trim() : null;
  }

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
