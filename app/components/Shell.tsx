import Link from "next/link";
import { WalletButton } from "./WalletButton";
import { ForgeTicker } from "./ForgeTicker";

const nav = [["Home", "/"], ["Market", "/market"], ["Launch", "/launch"], ["Trade", "/trade"], ["Pools", "/pools"], ["Portfolio", "/portfolio"], ["Developers", "/developers"]];
const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "devnet";

export function Shell({ children }: { children: React.ReactNode }) {
  const isMainnet = cluster === "mainnet-beta";
  return <div className="min-h-screen bg-[#070707] text-white">
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#070707]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="shrink-0 text-lg font-black tracking-[0.18em] sm:text-xl sm:tracking-[0.22em]">FORGE <span className="text-[#f5c542]">X</span></Link>
          <span className={`hidden rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] sm:inline-flex ${isMainnet ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-300" : "border-amber-300/20 bg-amber-300/5 text-amber-200"}`}>
            {isMainnet ? "Mainnet" : `${cluster} · Test`}
          </span>
        </div>
        <nav className="hidden gap-5 text-sm text-white/60 xl:flex">{nav.map(([label, href]) => <Link key={href} href={href} className="transition hover:text-white">{label}</Link>)}</nav>
        <div className="flex items-center gap-2">
          <details className="relative xl:hidden">
            <summary className="flex h-9 cursor-pointer list-none items-center rounded-lg border border-white/10 bg-white/[0.03] px-3 text-xs font-bold text-white/70 hover:text-white">Menu</summary>
            <div className="absolute right-0 top-11 z-50 w-52 rounded-2xl border border-white/10 bg-[#0c0c0c] p-2 shadow-2xl shadow-black/50">
              <div className="px-3 pb-2 pt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">Navigate</div>
              {nav.map(([label, href]) => <Link key={href} href={href} className="block rounded-xl px-3 py-2.5 text-sm text-white/65 transition hover:bg-white/[0.05] hover:text-white">{label}</Link>)}
              <div className="my-2 border-t border-white/10" />
              <Link href="/ai" className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-[#f5c542] transition hover:bg-[#f5c542]/10">FORGE AI</Link>
            </div>
          </details>
          <Link href="/ai" className="hidden rounded-full border border-[#f5c542]/20 bg-[#f5c542]/5 px-3 py-2 text-xs font-bold text-[#f5c542] transition hover:bg-[#f5c542]/10 sm:inline-flex">FORGE AI</Link>
          <WalletButton />
        </div>
      </div>
      <ForgeTicker />
    </header>
    {children}
    <footer className="border-t border-white/10 px-5 py-10 text-center text-xs text-white/35">FORGE X · Solana-native infrastructure · Built for the next on-chain economy.</footer>
  </div>;
}

export function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) { return <div className="mb-8"><div className="text-xs font-bold uppercase tracking-[0.22em] text-[#f5c542]">{eyebrow}</div><h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">{title}</h1><p className="mt-3 max-w-2xl text-white/50">{text}</p></div>; }
export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) { return <div className={`rounded-2xl border border-white/10 bg-white/[0.025] p-6 ${className}`}>{children}</div>; }
