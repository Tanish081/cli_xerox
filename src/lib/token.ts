import type { SupabaseClient } from "@supabase/supabase-js";

// Assigns the next token number for the day (tokens reset daily) and an
// estimated ready time.
export async function assignToken(
  supabase: SupabaseClient,
  readyInMinutes = 30
): Promise<{ token_number: number; estimated_ready_at: string }> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data: lastToken } = await supabase
    .from("orders")
    .select("token_number")
    .not("token_number", "is", null)
    .gte("created_at", startOfDay.toISOString())
    .order("token_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const tokenNumber = (lastToken?.token_number ?? 0) + 1;
  const estimatedReadyAt = new Date(Date.now() + readyInMinutes * 60 * 1000).toISOString();

  return { token_number: tokenNumber, estimated_ready_at: estimatedReadyAt };
}
