import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FORGE X — Solana DeFi Infrastructure",
  description: "A focused Solana platform for launching, trading, liquidity and on-chain intelligence.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en"><body>{children}</body></html>
  );
}
