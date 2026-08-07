import type { SupabaseClient } from "@supabase/supabase-js";

const WINDOW_MINUTES = 15;
const MAX_ATTEMPTS = 5;

// Checks the lookup_attempts table for both identifiers (phone + IP) over
// the trailing window. Either one tripping the limit blocks the request,
// since either could be the abusive party.
export async function isRateLimited(
  supabase: SupabaseClient,
  identifiers: string[]
): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

  for (const identifier of identifiers) {
    const { count } = await supabase
      .from("lookup_attempts")
      .select("id", { count: "exact", head: true })
      .eq("identifier", identifier)
      .gte("attempted_at", since);

    if ((count ?? 0) >= MAX_ATTEMPTS) return true;
  }
  return false;
}

export async function logAttempt(
  supabase: SupabaseClient,
  identifiers: string[]
): Promise<void> {
  await supabase
    .from("lookup_attempts")
    .insert(identifiers.map((identifier) => ({ identifier })));
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
