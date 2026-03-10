import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-inter",
});

const chomsky = localFont({
  src: "../../public/fonts/Chomsky.otf",
  display: "swap",
  variable: "--font-chomsky",
});

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
    <html lang="en" className={`${inter.variable} ${chomsky.variable}`}>
      <body>
        <div className="app-shell">
          <div className="app-content">{children}</div>
        </div>
      </body>
    </html>
  );
}
