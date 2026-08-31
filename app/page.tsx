import Link from "next/link";
import { Shell, Card } from "./components/Shell";

const stats = [["$2.4B+", "Tracked volume"], ["18.7K", "Markets indexed"], ["<1s", "UI response target"]];

export default function Home() {
  return <Shell>
    <main>
      <section className="relative overflow-hidden px-5 pb-24 pt-24 lg:px-8 lg:pt-32">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-[#f5c542]/10 blur-[110px]" />
        <div className="relative mx-auto max-w-6xl text-center">
          <div className="mb-6 inline-flex rounded-full border border-[#f5c542]/20 bg-[#f5c542]/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#f5c542]">Built for Solana</div>
          <h1 className="text-5xl font-black tracking-[-0.04em] sm:text-7xl lg:text-8xl">Forge the next <span className="block text-[#f5c542]">on-chain economy.</span></h1>
          <p className="mx-auto mt-7 max-w-2xl text-base leading-7 text-white/55 sm:text-lg">Launch tokens, discover markets, trade assets, manage liquidity and monitor risk from one focused Solana-native workspace.</p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/launch" className="rounded-full bg-[#f5c542] px-7 py-3.5 font-bold text-black hover:bg-[#ffd75e]">Launch a Token</Link><Link href="/market" className="rounded-full border border-white/15 bg-white/[0.04] px-7 py-3.5 font-bold hover:bg-white/[0.08]">Explore Market</Link></div>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-4 px-5 pb-20 sm:grid-cols-3 lg:px-8">{stats.map(([value,label]) => <Card key={label}><div className="text-3xl font-black">{value}</div><div className="mt-2 text-sm text-white/40">{label}</div></Card>)}</section>
      <section className="mx-auto grid max-w-7xl gap-4 px-5 pb-24 md:grid-cols-3 lg:px-8">
        {[['Launch','Create and configure tokens with transparent authority and metadata choices.','/launch'],['Trade','Move from discovery to execution with a clean trading workspace.','/trade'],['Build','Plan liquidity and pool creation with clear risk and fee information.','/pools']].map(([title,text,href]) => <Card key={title}><div className="text-xs font-bold uppercase tracking-[0.2em] text-[#f5c542]">FORGE</div><h2 className="mt-5 text-2xl font-bold">{title}</h2><p className="mt-3 text-sm leading-6 text-white/50">{text}</p><Link href={href} className="mt-6 inline-block text-sm font-semibold text-[#f5c542]">Open {title} →</Link></Card>)}
      </section>
    </main>
  </Shell>;
}
