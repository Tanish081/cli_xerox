import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser client — used only by the admin dashboard for Supabase Auth
 * (login/logout, session refresh). Customer flows never touch this; they
 * go through server API routes with the service-role client instead.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
