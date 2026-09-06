import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/ui/Logo";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-[hsl(var(--background))]">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Logo size={72} className="mb-4" priority />
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
