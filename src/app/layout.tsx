import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Akshar Times — Connections",
  description: "The Akshar Times word puzzle game",
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
