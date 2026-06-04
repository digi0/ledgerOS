/**
 * Route guard (Next 16 renamed middleware → proxy). Refreshes the Supabase
 * session cookie and redirects logged-out users to /login.
 *
 * Gated behind NEXT_PUBLIC_AUTH_ENABLED: while we build the inbox on seed
 * data (rungs 1–4) this is pass-through, so local dev needs no login. Rung 5
 * flips the flag and the guard goes live.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const AUTH_ENABLED = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";

/** Auth pages — reachable when logged out; redirect away when logged in. */
const AUTH_PATHS = ["/login", "/signup"];

function isPublic(pathname: string): boolean {
  if (AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;
  if (pathname.startsWith("/auth/")) return true; // oauth callback routes
  return false;
}

export async function proxy(request: NextRequest) {
  // Auth not wired yet → let everything through, but still refresh nothing.
  if (!AUTH_ENABLED) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && AUTH_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
