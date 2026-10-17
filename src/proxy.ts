import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/** Routes reachable without signing in. */
const PUBLIC_PATHS = ["/login"];

/**
 * Refreshes the Supabase session on every page request and performs the
 * optimistic auth redirect. Data access re-checks the user (and RLS
 * enforces it in the database), so this is not the only line of defense.
 */
export async function proxy(request: NextRequest) {
  const { response, userId } = await updateSession(request);
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isDevGallery = process.env.NODE_ENV !== "production" && pathname.startsWith("/dev/");

  if (!userId && !isPublic && !isDevGallery) {
    return redirectWithCookies(request, response, "/login");
  }
  if (userId && isPublic) {
    return redirectWithCookies(request, response, "/");
  }
  return response;
}

/** Redirect while keeping any refreshed auth cookies from `updateSession`. */
function redirectWithCookies(request: NextRequest, from: NextResponse, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  from.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "location") redirect.headers.set(key, value);
  });
  return redirect;
}

export const config = {
  // Skip Next internals and static files (anything with a file extension).
  matcher: ["/((?!_next/static|_next/image|.*\\.[\\w]+$).*)"],
};
