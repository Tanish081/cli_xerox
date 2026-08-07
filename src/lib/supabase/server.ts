import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server client bound to the incoming request's cookies — used for admin
 * Auth session checks in server components / route handlers. Subject to RLS.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component — ignored when middleware
            // is refreshing the session.
          }
        },
      },
    }
  );
}
