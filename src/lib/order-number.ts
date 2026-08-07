import type { SupabaseClient } from "@supabase/supabase-js";

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O, avoids confusion with 1/0

function randomOrderNumber(): string {
  const letter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
  const digits = Math.floor(Math.random() * 900 + 100); // 100-999
  return `${letter}${digits}`;
}

// Generates a short human-readable order number (e.g. "A214"), retrying on
// the rare collision. Caller must pass a service-role client since the
// orders table is default-deny under RLS.
export async function generateOrderNumber(
  supabase: SupabaseClient
): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = randomOrderNumber();
    const { data } = await supabase
      .from("orders")
      .select("id")
      .eq("order_number", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  throw new Error("Could not generate a unique order number");
}
