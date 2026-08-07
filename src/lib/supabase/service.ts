import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS. Server-only: never import this from
 * client components or expose the key to the browser. Used by API routes
 * for all customer-facing flows (order creation, uploads, lookup) since
 * those tables are default-deny under RLS and the app enforces access
 * control (session cookie / phone match / rate limiting) itself.
 */
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
