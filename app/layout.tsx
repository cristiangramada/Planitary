import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { siteUrl } from "@/lib/site-url";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteDescription =
  "A modern productivity app for tasks, calendar, and journaling.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Planitary",
    template: "%s | Planitary",
  },
  description: siteDescription,
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Planitary",
    title: "Planitary",
    description: siteDescription,
    images: [{ url: "/planitary-logo.png", alt: "Planitary" }],
  },
  twitter: {
    card: "summary",
    title: "Planitary",
    description: siteDescription,
    images: ["/planitary-logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full overflow-hidden">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
