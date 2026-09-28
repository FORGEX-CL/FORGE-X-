import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {\n  width: "device-width",\n  initialScale: 0.85,\n  minimumScale: 0.5,\n  maximumScale: 1,\n  userScalable: true,\n};\n\nexport const metadata: Metadata = {
  title: "FORGE X — Solana DeFi Infrastructure",
  description: "A focused Solana platform for launching, trading, liquidity and on-chain intelligence.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en"><body>{children}</body></html>
  );
}
