import Link from "next/link";
import { Globe } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-[hsl(var(--background))]">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[hsl(var(--primary)/0.15)] mb-4">
            <Globe className="w-6 h-6 text-[hsl(var(--primary))]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Sign in to your Planitary account
          </p>
        </div>

        {/* Suspense required because LoginForm uses useSearchParams */}
        <Suspense fallback={<div className="h-48" />}>
          <LoginForm />
        </Suspense>

        <p className="mt-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-[hsl(var(--primary))] hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
