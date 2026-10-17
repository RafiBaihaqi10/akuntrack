import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";

/** Supabase client for Client Components. Session lives in cookies shared with the server. */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
