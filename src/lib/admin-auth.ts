import { createClient } from "@/lib/supabase/server";

// Confirms the request carries a valid Supabase Auth session for the admin
// account. Admin API routes call this before touching the service-role
// client, since the service client itself bypasses RLS and has no notion
// of "who is calling."
export async function requireAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return !!user;
}
