import { Shell, SectionTitle, Card } from "../components/Shell";
import { FairLaunchTrader } from "../components/FairLaunchTrader";

export default function Trade() {
  return (
    <Shell>
      <main className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
        <SectionTitle eyebrow="Trade" title="Trade the FORGE X curve." text="Fair Launch execution is wallet-signed and confirmed on-chain. The interface keeps the transaction boundary explicit: FORGE X prepares the instruction, your wallet approves it, Solana confirms it." />
        <div className="grid gap-5 lg:grid-cols-[1.4fr_.8fr]">
          <Card className="min-h-[430px]">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#f5c542]">Execution model</p>
            <h2 className="mt-3 text-2xl font-black">Bonding-curve trading</h2>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {["0.50% protocol trade fee", "Developer first buy: 0.5 SOL minimum", "Public trading opens after first buy", "Trading stops when graduation is reached", "Graduation target: 85 SOL", "Post-graduation liquidity: Raydium CPMM"].map((item) => (
                <div key={item} className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">{item}</div>
              ))}
            </div>
            <div className="mt-7 rounded-xl border border-[#f5c542]/15 bg-[#f5c542]/5 p-5 text-sm leading-6 text-white/55">
              FORGE X does not report a trade as successful merely because a transaction was submitted. The UI waits for the actual Solana signature status and blockhash validity window.
            </div>
          </Card>
          <FairLaunchTrader />
        </div>
      </main>
    </Shell>
  );
}
