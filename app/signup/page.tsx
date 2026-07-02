import Link from "next/link";
import { Globe } from "lucide-react";
import type { Metadata } from "next";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-[hsl(var(--background))]">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[hsl(var(--primary)/0.15)] mb-4">
            <Globe className="w-6 h-6 text-[hsl(var(--primary))]" />
          </div>
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
