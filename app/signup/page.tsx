import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/ui/Logo";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = {
  title: "Create account",
  robots: { index: false, follow: true },
};

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-[hsl(var(--background))]">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Logo size={72} className="mb-4" priority />
          <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Start your productivity journey
          </p>
        </div>

        <SignupForm />

        <p className="mt-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-[hsl(var(--primary))] hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
