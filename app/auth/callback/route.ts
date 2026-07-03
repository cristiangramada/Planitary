import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Handles the email confirmation / magic-link callback from Supabase.
 *
 * Supabase redirects here after a user clicks the confirmation link in their
 * email (when email confirmation is enabled in your project settings).
 * The `code` query param is exchanged for a real session token, then the user
 * is forwarded to their intended destination (default: /dashboard).
 *
 * Set the "Site URL" and "Redirect URLs" in your Supabase Auth settings to
 * include <your-domain>/auth/callback so the redirect is allowed.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Redirect to the intended destination after successful sign-in
      const redirectUrl = new URL(next, origin);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Something went wrong — send the user back to login with an error hint
  const errorUrl = new URL("/login", origin);
  errorUrl.searchParams.set("error", "auth_callback_failed");
  return NextResponse.redirect(errorUrl);
}
