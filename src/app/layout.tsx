import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import { getCurrentUser } from "@/server/auth/session";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });

export const metadata: Metadata = {
  title: { default: "PrepX", template: "%s · PrepX" },
  description: "Study for your DECA, FBLA, HOSA or TSA event, check in at meetings and keep up with your chapter, all in one app.",
  manifest: "/manifest.webmanifest",
  applicationName: "PrepX",
  appleWebApp: { capable: true, title: "PrepX", statusBarStyle: "default" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0b" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const accent = user?.profile?.accentColor ?? "ink";
  return (
    <html lang="en" data-accent={accent} className={outfit.variable}>
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-fg focus:px-4 focus:py-2 focus:text-bg">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
