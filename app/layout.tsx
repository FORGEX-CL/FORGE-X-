import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FORGE X — Solana DeFi Infrastructure",
  description: "A premium Solana platform for launching, trading and building on-chain.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
