import { Shell, SectionTitle, Card } from "../components/Shell";
import { TradeMode } from "../components/TradeMode";

export default function Trade() {
  return (
    <Shell>
      <main className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
        <SectionTitle eyebrow="Trade" title="Trade verified Solana markets." text="Fair Launch execution stays on the FORGE X bonding curve. Migrated liquidity uses a separately verified Raydium CPMM transaction path." />
        <div className="grid gap-5 lg:grid-cols-[1.4fr_.8fr]">
          <Card className="min-h-[430px]">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#f5c542]">Execution model</p>
            <h2 className="mt-3 text-2xl font-black">Verified transaction paths</h2>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {["Fair Launch: 0.50% protocol fee", "Developer first buy: 0.05 SOL minimum", "Public curve trading opens after first buy", "Curve trading stops at graduation", "Graduated liquidity: verified Raydium CPMM", "Wallet signs every swap"].map((item) => (
                <div key={item} className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">{item}</div>
              ))}
            </div>
            <div className="mt-7 rounded-xl border border-[#f5c542]/15 bg-[#f5c542]/5 p-5 text-sm leading-6 text-white/55">
              FORGE X verifies the selected pool account against the expected Raydium CPMM program before preparing a migrated-pool swap. A submitted transaction is not reported as successful until Solana confirms it.
            </div>
          </Card>
          <TradeMode />
        </div>
      </main>
    </Shell>
  );
}
