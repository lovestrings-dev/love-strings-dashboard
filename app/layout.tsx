import type { Metadata } from "next";
import "./globals.css";
import { cookies } from "next/headers";
import { AppearanceProvider } from "./components/appearance-provider";
import { resolveTheme, themeCookieName } from "@/lib/appearance";

export const metadata: Metadata = {
  title: "ArtistDeck",
  description: "A workspace dashboard for planning, releases, budget, and platform metrics.",
  icons: {
    apple: "/artistdeck-logo.png",
    icon: "/artistdeck-logo.png"
  }
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = resolveTheme((await cookies()).get(themeCookieName)?.value);
  return (
    <html lang="en" data-theme={theme} suppressHydrationWarning>
      <body><AppearanceProvider initialTheme={theme}>{children}</AppearanceProvider></body>
    </html>
  );
}
