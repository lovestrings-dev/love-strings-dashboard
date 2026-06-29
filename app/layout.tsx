import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Love Strings Dashboard",
  description: "Daily operating dashboard for Love Strings releases, sprints, budget, and platform metrics."
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
