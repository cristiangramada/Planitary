"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";
import { DisableNativeContextMenu } from "./DisableNativeContextMenu";

interface ThemeProviderProps {
  children: ReactNode;
}

// next-themes injects an inline <script> to prevent theme flash. React 19 /
// Next 16 warn about <script> inside components; the script still runs correctly
// during SSR. Filter that known false positive in development only.
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    const first = args[0];
    if (
      typeof first === "string" &&
      first.includes("Encountered a script tag while rendering React component")
    ) {
      return;
    }
    originalError.apply(console, args);
  };
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <DisableNativeContextMenu />
      {children}
    </NextThemesProvider>
  );
}
