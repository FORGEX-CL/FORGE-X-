import Link from "next/link";
import { WalletButton } from "./WalletButton";

const nav = [
  ["Home", "/"], ["Market", "/market"], ["Launch", "/launch"], ["Trade", "/trade"],
  ["Pools", "/pools"], ["Portfolio", "/portfolio"], ["Developers", "/developers"],
];

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#070707] text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#070707]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <Link href="/" className="shrink-0 text-xl font-black tracking-[0.22em]">FORGE <span className="text-[#f5c542]">X</span></Link>
          <nav className="hidden gap-5 text-sm text-white/60 xl:flex">
            {nav.map(([label, href]) => <Link key={href} href={href} className="transition hover:text-white">{label}</Link>)}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/ai" className="rounded-full border border-[#f5c542]/20 bg-[#f5c542]/5 px-3 py-2 text-xs font-bold text-[#f5c542] transition hover:bg-[#f5c542]/10">FORGE AI</Link>
            <WalletButton />
          </div>
        </div>
      </header>
      {children}
      <footer className="border-t border-white/10 px-5 py-10 text-center text-xs text-white/35">FORGE X · Solana-native infrastructure · Built for the next on-chain economy.</footer>
    </div>
  );
}

export function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return <div className="mb-8"><div className="text-xs font-bold uppercase tracking-[0.22em] text-[#f5c542]">{eyebrow}</div><h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">{title}</h1><p className="mt-3 max-w-2xl text-white/50">{text}</p></div>;
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-white/10 bg-white/[0.025] p-6 ${className}`}>{children}</div>;
}
