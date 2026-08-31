const nav = ["Home", "Market", "Launch", "Trade", "Pools", "Portfolio", "Developers"];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#070707] text-white">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between border-b border-white/10 px-6 py-5 lg:px-8">
        <a href="#" className="text-xl font-black tracking-[0.22em]">
          FORGE <span className="text-[#f5c542]">X</span>
        </a>
        <nav className="hidden gap-7 text-sm text-white/65 md:flex">
          {nav.map((item) => <a key={item} href={`#${item.toLowerCase()}`} className="transition hover:text-white">{item}</a>)}
        </nav>
        <button className="rounded-full border border-[#f5c542]/50 bg-[#f5c542] px-5 py-2 text-sm font-bold text-black transition hover:bg-[#ffd75e]">
          Connect Wallet
        </button>
      </header>

      <section className="relative overflow-hidden px-6 pb-24 pt-24 lg:px-8 lg:pt-32">
        <div className="pointer-events-none absolute left-1/2 top-10 h-96 w-96 -translate-x-1/2 rounded-full bg-[#f5c542]/10 blur-3xl" />
        <div className="relative mx-auto max-w-5xl text-center">
          <div className="mb-6 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#f5c542]">
            Built for Solana
          </div>
          <h1 className="text-5xl font-black tracking-tight sm:text-7xl lg:text-8xl">
            Forge the next
            <span className="block text-[#f5c542]">on-chain economy.</span>
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-base leading-7 text-white/55 sm:text-lg">
            Launch tokens, discover markets, trade assets and build liquidity — all from one powerful Solana-native platform.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <button className="rounded-full bg-[#f5c542] px-7 py-3.5 font-bold text-black hover:bg-[#ffd75e]">Launch a Token</button>
            <button className="rounded-full border border-white/15 bg-white/[0.04] px-7 py-3.5 font-bold hover:bg-white/[0.08]">Explore Market</button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-6 pb-24 sm:grid-cols-3 lg:px-8">
        {[
          ["01", "Launch", "Create and configure Solana tokens with a clear, guided flow."],
          ["02", "Trade", "Move from discovery to execution with a fast trading experience."],
          ["03", "Build", "Create liquidity pools and grow your on-chain ecosystem."],
        ].map(([num, title, text]) => (
          <article key={num} className="rounded-2xl border border-white/10 bg-white/[0.025] p-7 hover:border-[#f5c542]/30">
            <span className="text-xs font-bold tracking-[0.2em] text-[#f5c542]">{num}</span>
            <h2 className="mt-8 text-2xl font-bold">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-white/50">{text}</p>
          </article>
        ))}
      </section>

      <footer className="border-t border-white/10 px-6 py-8 text-center text-xs text-white/35">
        FORGE X · Solana infrastructure for the next generation.
      </footer>
    </main>
  );
}
