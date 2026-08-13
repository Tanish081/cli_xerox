import type { SupabaseClient } from "@supabase/supabase-js";

export const SHOP_ASSETS_BUCKET = "shop-assets";

export type ShopSettings = {
  shop_name: string;
  qr_image_path: string | null;
  upi_payload: string | null;
};

export async function getShopSettings(supabase: SupabaseClient): Promise<ShopSettings | null> {
  const { data, error } = await supabase
    .from("shop_settings")
    .select("shop_name, qr_image_path, upi_payload")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}
