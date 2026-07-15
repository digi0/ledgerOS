import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Auth middleware. Two jobs when auth is on (NEXT_PUBLIC_AUTH_ENABLED=true):
 *   1. Refresh the Supabase session cookie every request — server components
 *      read it as read-only, so the token has to be refreshed here (this is the
 *      "proxy" lib/supabase.ts refers to).
 *   2. Gate the app — an unauthenticated request to anything but the auth pages
 *      is redirected to /login. Without this, a signed-out visitor would land on
 *      empty (RLS-scoped) pages instead of being sent to sign in.
 *
 * When auth is off (demo mode) it's a no-op, so the demo experience is intact.
 */

const PUBLIC_PATHS = ["/login", "/signup"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (process.env.NEXT_PUBLIC_AUTH_ENABLED !== "true") return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // IMPORTANT: getUser() (not getSession) — it revalidates the token with the
  // Supabase auth server, and triggers the cookie refresh via setAll above.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
