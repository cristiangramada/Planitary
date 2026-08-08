import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Route prefixes that never require authentication.
 */
const PUBLIC_PREFIXES = ["/", "/login", "/signup", "/auth"];

/**
 * Routes that authenticated users should be redirected away from.
 * Exact `/` is handled separately — prefix matching would match every path.
 */
const AUTH_ONLY_PREFIXES = ["/login", "/signup"];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some(
    (prefix) => prefix !== "/" && pathname.startsWith(prefix)
  );
}

function isAuthOnlyPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return AUTH_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Next.js 16 Proxy (formerly middleware).
 *
 * Responsibilities:
 *  1. Refresh the Supabase session token on every request so it stays valid.
 *  2. Redirect unauthenticated visitors from protected routes to /login.
 *  3. Redirect authenticated users away from /, /login, and /signup to /dashboard.
 */
export async function proxy(request: NextRequest) {
  // We mutate supabaseResponse when Supabase needs to write cookies, so we
  // start with a pass-through response that forwards all request headers.
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Sync updated cookies onto both the request and the response so
          // downstream Server Components see the refreshed session.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Do not add any logic between createServerClient and getUser().
  // getUser() refreshes the session if the token has expired. Inserting code
  // before it can cause the session refresh to be skipped.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Unauthenticated user on a protected route → redirect to /login
  if (!user && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    // Preserve the originally requested URL so we can bounce back after login
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user visiting welcome/login/signup → redirect to /dashboard
  if (user && isAuthOnlyPath(pathname)) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Run on all paths except Next.js internals and static assets.
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
