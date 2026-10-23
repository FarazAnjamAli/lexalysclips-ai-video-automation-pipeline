import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { StudioProvider } from "@/components/StudioProvider";
import { AppShell } from "@/components/AppShell";
import { BRAND } from "@/config/brand";

// UI fonts — swap these two to change the whole app's typeface
// (bundled with the app, no internet needed to build)
const ui = localFont({ src: "../node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2", variable: "--font-ui", weight: "100 900" });
const uiMono = localFont({ src: "../node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2", variable: "--font-ui-mono", weight: "100 900" });

export const metadata: Metadata = { title: BRAND.name, description: BRAND.tagline };

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#08080a" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className={`${ui.variable} ${uiMono.variable}`}>
        <StudioProvider>
          <AppShell>{children}</AppShell>
        </StudioProvider>
      </body>
    </html>
  );
}
