import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LS Dashboard",
  description: "A workspace dashboard for planning, releases, budget, and platform metrics."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
