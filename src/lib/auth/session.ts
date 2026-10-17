import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
};

/**
 * Data Access Layer entry point: returns the verified signed-in user or
 * redirects to /login. Reads cookies, so call it inside a <Suspense> boundary.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login");
  return { id: claims.sub, email: (claims.email as string | undefined) ?? "" };
}
