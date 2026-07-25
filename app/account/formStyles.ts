// Shared Tailwind class strings for Account page forms — mirrors the classes
// used by LoginForm/SignupForm so the Account page matches existing inputs
// and buttons without introducing a separate form component library.

export const inputClass =
  "w-full px-3 py-2.5 text-sm rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none transition disabled:opacity-60 disabled:cursor-not-allowed";

export const labelClass = "block text-sm font-medium mb-1.5";

export const primaryButtonClass =
  "px-4 py-2.5 text-sm font-semibold rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity cursor-pointer";

export const errorBannerClass =
  "flex items-start gap-2 text-sm text-red-500 bg-red-500/10 px-3 py-2.5 rounded-lg";

export const successBannerClass =
  "flex items-start gap-2 text-sm text-green-500 bg-green-500/10 px-3 py-2.5 rounded-lg";
