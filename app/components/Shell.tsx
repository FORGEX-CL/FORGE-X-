import Link from "next/link";
import { WalletButton } from "./WalletButton";
import { ForgeTicker } from "./ForgeTicker";
import { AIChatBar } from "./AIChatBar";

const nav = [["Home", "/"], ["Market", "/market"], ["Launch", "/launch"], ["Portfolio", "/portfolio"], ["Developers", "/developers"]];
const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "devnet";

export function Shell({ children }: { children: React.ReactNode }) {
  const isMainnet = cluster === "mainnet-beta";
  return <div className="forge-page min-h-screen bg-[var(--background)] text-white">
    <header className="sticky top-0 z-50 w-full overflow-visible border-b border-white/10 bg-[var(--header)]/95 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl min-w-0 items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-5 sm:py-3 lg:px-8">
        <div className="flex min-w-0 shrink items-center gap-2.5 sm:gap-3">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <img src="/forge-x-mark.svg" alt="FORGE X" className="h-8 w-8 rounded-md object-cover sm:h-9 sm:w-9" />
            <span className="text-base font-black tracking-[-0.03em] sm:text-xl">FORGE<span className="text-[var(--brand-yellow)]">X</span></span>
          </Link>
          <span className={`hidden rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] sm:inline-flex ${isMainnet ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-300" : "border-amber-300/20 bg-amber-300/5 text-amber-200"}`}>
            {isMainnet ? "Mainnet" : `${cluster} · Test`}
          </span>
        </div>
        <nav className="hidden gap-5 text-sm font-semibold text-white/65 xl:flex">{nav.map(([label, href]) => <Link key={href} href={href} className="transition hover:text-[var(--brand-yellow)]">{label}</Link>)}</nav>
        <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
          <details className="relative xl:hidden">
            <summary className="flex h-9 cursor-pointer list-none items-center rounded-md border border-white/10 bg-white/[0.03] px-3 text-xs font-bold text-white/75 hover:text-white">Menu</summary>
            <div className="absolute right-0 top-11 z-50 w-[min(14rem,calc(100vw-1.5rem))] rounded-xl border border-white/10 bg-[var(--surface)] p-2 shadow-2xl shadow-black/50">
              <div className="px-3 pb-2 pt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">Navigate</div>
              {nav.map(([label, href]) => <Link key={href} href={href} className="block rounded-lg px-3 py-2.5 text-sm text-white/70 transition hover:bg-white/[0.05] hover:text-[var(--brand-yellow)]">{label}</Link>)}
              <div className="my-2 border-t border-white/10" />
              <Link href="/ai" className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-[var(--brand-yellow)] transition hover:bg-[var(--brand-yellow)]/10">FORGE AI</Link>
            </div>
          </details>
          <Link href="/ai" className="hidden rounded-md border border-[var(--brand-yellow)]/30 bg-[var(--brand-yellow)]/10 px-3 py-2 text-xs font-bold text-[var(--brand-yellow)] transition hover:bg-[var(--brand-yellow)]/15 sm:inline-flex">FORGE AI</Link>
          <WalletButton />
        </div>
      </div>
      <ForgeTicker />
    </header>
    {children}
    <footer className="w-full overflow-hidden border-t border-white/10 px-4 py-8 pb-24 text-center text-xs text-white/35 sm:px-5 sm:py-10 sm:pb-28">FORGE X</footer>
    <AIChatBar />
  </div>;
}

export function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string; text?: string }) {
  return <div className="mb-6 sm:mb-8"><div className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-yellow)]">{eyebrow}</div><h1 className="mt-2 text-3xl font-black tracking-tight sm:mt-3 sm:text-5xl">{title}</h1></div>;
}
export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 ${className}`}>{children}</div>;
}
