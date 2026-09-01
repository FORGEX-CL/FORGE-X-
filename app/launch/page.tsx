import { Shell, SectionTitle, Card } from "../components/Shell";

const steps = [
  ["01", "Token details", "Name, symbol, description and logo."],
  ["02", "Fair Launch", "FORGE X fixes the supply and launch rules automatically."],
  ["03", "Developer buy", "The developer must make the first buy before public trading opens."],
  ["04", "Review & sign", "Every blockchain transaction is reviewed before the connected wallet signs it."],
];

const rules = [
  ["Supply", "1,000,000,000"],
  ["Decimals", "9"],
  ["Developer first buy", "0.5 SOL minimum"],
  ["Launch fee", "0.02 SOL"],
  ["Trading fee", "0.50%"],
  ["Graduation target", "85 SOL raised"],
];

export default function Launch() {
  return (
    <Shell>
      <main className="mx-auto max-w-6xl px-5 py-12 lg:px-8">
        <div className="mb-10 flex items-center gap-5">
          <img src="/forge-x-mark.svg" alt="FORGE X" className="h-20 w-20 rounded-2xl" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#f5c542]">FORGE X</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">Fair Launch</h1>
          </div>
        </div>

        <SectionTitle
          eyebrow="Launch"
          title="Launch without manual complexity."
          text="FORGE X handles the Fair Launch configuration automatically while keeping the final blockchain actions under the connected wallet's signature."
        />

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {steps.map(([n, t, d]) => (
            <Card key={n}>
              <span className="text-xs font-bold text-[#f5c542]">{n}</span>
              <h2 className="mt-5 text-xl font-bold">{t}</h2>
              <p className="mt-2 text-sm leading-6 text-white/45">{d}</p>
            </Card>
          ))}
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_.8fr]">
          <Card>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#f5c542]">Fair Launch mode</p>
                <h2 className="mt-2 text-2xl font-black">Automatic configuration</h2>
              </div>
              <span className="rounded-full border border-[#f5c542]/30 bg-[#f5c542]/10 px-3 py-1 text-xs font-bold text-[#f5c542]">DEVNET</span>
            </div>

            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-white/60">Token name<input className="forge-input" placeholder="My Token" /></label>
              <label className="text-sm text-white/60">Symbol<input className="forge-input" placeholder="TOKEN" /></label>
              <label className="text-sm text-white/60 sm:col-span-2">Description<textarea className="forge-input min-h-28" placeholder="Tell the market what this project is about." /></label>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-sm font-bold">What FORGE X locks automatically</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[["Fixed supply", "1B tokens"], ["Mint authority", "Revoked"], ["Freeze authority", "Revoked"], ["Metadata", "Finalized after launch"]].map(([a, b]) => (
                  <div key={a} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-4 py-3 text-sm">
                    <span className="text-white/50">{a}</span><span className="font-semibold">{b}</span>
                  </div>
                ))}
              </div>
            </div>

            <button className="mt-6 rounded-full bg-[#f5c542] px-6 py-3 font-bold text-black">Review Fair Launch</button>
          </Card>

          <Card>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#f5c542]">Protocol rules</p>
            <div className="mt-5 space-y-3">
              {rules.map(([a, b]) => (
                <div key={a} className="flex items-center justify-between border-b border-white/10 pb-3 text-sm">
                  <span className="text-white/45">{a}</span><span className="font-bold">{b}</span>
                </div>
              ))}
            </div>
            <p className="mt-5 text-xs leading-5 text-white/35">These values are the current Devnet protocol configuration. Mainnet economics remain subject to final security and economic testing.</p>
          </Card>
        </div>
      </main>
    </Shell>
  );
}
