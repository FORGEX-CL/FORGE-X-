import Image from "next/image";
import { Shell, SectionTitle, Card } from "../components/Shell";
import { WalletButton } from "../components/WalletButton";
import { TokenLaunchSigner } from "../components/TokenLaunchSigner";

const steps = [
  ["01", "Token details", "Name, symbol and metadata are supplied by the creator."],
  ["02", "Fair Launch", "FORGE X fixes the supply and launch rules automatically."],
  ["03", "Developer buy", "The developer must make the first buy before public trading opens."],
  ["04", "Review & sign", "The connected wallet signs the real blockchain transaction."],
];

const rules = [
  ["Supply", "1,000,000,000"],
  ["Decimals", "9"],
  ["Developer first buy", "0.05 SOL minimum"],
  ["Launch fee", "0.02 SOL"],
  ["Trading fee", "0.50%"],
  ["Graduation target", "85 SOL raised"],
];

export default function Launch() {
  return (
    <Shell>
      <main className="mx-auto max-w-6xl px-5 py-12 lg:px-8">
        <div className="mb-10 flex items-center justify-between gap-5">
          <div className="flex items-center gap-5">
            <Image src="/forge-x-mark.svg" alt="FORGE X" width={80} height={80} className="rounded-2xl" priority />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#f5c542]">FORGE X</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight">Launch</h1>
            </div>
          </div>
          <WalletButton />
        </div>

        <SectionTitle
          eyebrow="Launch"
          title="Launch without manual complexity."
          text="Fair Launch applies FORGE X protocol rules automatically. The wallet remains the authority for every user-funded blockchain action."
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
          <TokenLaunchSigner />

          <Card>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#f5c542]">Protocol rules</p>
            <div className="mt-5 space-y-3">
              {rules.map(([a, b]) => (
                <div key={a} className="flex items-center justify-between border-b border-white/10 pb-3 text-sm">
                  <span className="text-white/45">{a}</span><span className="font-bold">{b}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl border border-[#f5c542]/15 bg-[#f5c542]/5 p-4 text-xs leading-5 text-white/55">
              Fair Launch also requires mint authority, freeze authority and metadata update authority to be revoked, with metadata made immutable in the launch transaction.
            </div>
            <p className="mt-4 text-xs leading-5 text-white/35">Current environment is controlled by the configured Solana cluster. Mainnet release requires successful Devnet end-to-end testing and security review.</p>
          </Card>
        </div>
      </main>
    </Shell>
  );
}
