import type { SupabaseClient } from "@supabase/supabase-js";

export const DOCUMENTS_BUCKET = "documents";
export const SCREENSHOTS_BUCKET = "payment-screenshots";
export const PRODUCT_IMAGES_BUCKET = "product-images";

// Unauthenticated (or session-cookie-only) customer endpoints accept these
// files, so a size cap matters for both cost and abuse resistance -- without
// one, nothing stops a huge upload from ballooning storage costs or (for the
// payment screenshot specifically) burning function time in OCR.
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024; // 20MB
export const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_ADMIN_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB (QR photo / product photo)

export async function uploadOrderFile(
  supabase: SupabaseClient,
  bucket: string,
  orderId: string,
  file: File
): Promise<string> {
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const path = `${orderId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

// For the public product-images bucket -- no signing needed, just the
// stable public URL.
export async function uploadPublicFile(supabase: SupabaseClient, bucket: string, file: File): Promise<string> {
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function signedUrl(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  expiresInSeconds = 60 * 10
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data.signedUrl;
}
