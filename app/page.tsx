import Link from "next/link";
import { Shell, Card } from "./components/Shell";

const stats = [["Live", "Solana market data"], ["7", "Core workspaces"], ["24/7", "On-chain access"]];
const modules = [
  ["Market", "Discover Solana tokens with live market signals and liquidity context.", "/market"],
  ["Launch", "Prepare a token launch with supply, metadata and authority controls.", "/launch"],
  ["Trade", "A focused execution workspace designed around clarity and speed.", "/trade"],
  ["Pools", "Track liquidity and prepare pool operations with transparent fee details.", "/pools"],
  ["Portfolio", "Bring wallet positions, balances and activity into one view.", "/portfolio"],
  ["Developers", "Build on FORGE X with documented endpoints and integration guides.", "/developers"],
];

export default function Home() {
  return <Shell>
    <main>
      <section className="relative overflow-hidden px-5 pb-24 pt-24 lg:px-8 lg:pt-32">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-[#f5c542]/10 blur-[120px]" />
        <div className="relative mx-auto max-w-6xl text-center">
          <div className="mb-6 inline-flex rounded-full border border-[#f5c542]/20 bg-[#f5c542]/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#f5c542]">Solana-native trading infrastructure</div>
          <h1 className="text-5xl font-black tracking-[-0.05em] sm:text-7xl lg:text-8xl">Forge the next <span className="block text-[#f5c542]">on-chain economy.</span></h1>
          <p className="mx-auto mt-7 max-w-2xl text-base leading-7 text-white/55 sm:text-lg">One focused workspace to discover markets, launch tokens, trade assets, manage liquidity and understand risk.</p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/launch" className="rounded-full bg-[#f5c542] px-7 py-3.5 font-bold text-black transition hover:-translate-y-0.5 hover:bg-[#ffd75e]">Launch a Token</Link><Link href="/market" className="rounded-full border border-white/15 bg-white/[0.04] px-7 py-3.5 font-bold transition hover:-translate-y-0.5 hover:bg-white/[0.08]">Explore Market</Link></div>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-4 px-5 pb-20 sm:grid-cols-3 lg:px-8">{stats.map(([value,label]) => <Card key={label}><div className="text-3xl font-black">{value}</div><div className="mt-2 text-sm text-white/40">{label}</div></Card>)}</section>
      <section className="mx-auto max-w-7xl px-5 pb-24 lg:px-8">
        <div className="mb-8"><div className="text-xs font-bold uppercase tracking-[0.2em] text-[#f5c542]">The FORGE</div><h2 className="mt-3 text-3xl font-black sm:text-4xl">Everything in one place.</h2></div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{modules.map(([title,text,href]) => <Card key={title}><div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-[0.2em] text-[#f5c542]">FORGE X</span><span className="text-white/20">↗</span></div><h2 className="mt-5 text-2xl font-bold">{title}</h2><p className="mt-3 text-sm leading-6 text-white/50">{text}</p><Link href={href} className="mt-6 inline-block text-sm font-semibold text-[#f5c542]">Open {title} →</Link></Card>)}</div>
      </section>
      <section className="mx-auto max-w-7xl px-5 pb-24 lg:px-8"><Card className="overflow-hidden bg-[#f5c542]/[0.06]"><div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center"><div><div className="text-xs font-bold uppercase tracking-[0.2em] text-[#f5c542]">FORGE AI</div><h2 className="mt-3 text-3xl font-black">Understand before you execute.</h2><p className="mt-3 max-w-2xl text-white/50">Use the intelligence layer to turn market and risk signals into simple, actionable context.</p></div><Link href="/ai" className="rounded-full border border-[#f5c542]/30 px-6 py-3 text-center font-semibold text-[#f5c542] hover:bg-[#f5c542]/10">Open FORGE AI →</Link></div></Card></section>
    </main>
  </Shell>;
}
