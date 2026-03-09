import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BKST NYC — Connections",
  description: "Custom Connections-style puzzle game",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
