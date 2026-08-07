import type { SupabaseClient } from "@supabase/supabase-js";

export const DOCUMENTS_BUCKET = "documents";
export const SCREENSHOTS_BUCKET = "payment-screenshots";

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
