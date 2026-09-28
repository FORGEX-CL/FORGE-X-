"use client";

import Image from "next/image";

import { Shell, SectionTitle, Card } from "../components/Shell";
import { WalletButton } from "../components/WalletButton";
import { TokenLaunchSigner } from "../components/TokenLaunchSigner";

const steps = [["01","Token details"],["02","Fair Launch"],["03","Review & sign"]];

const rules = [
  ["Fair supply", "1,000,000,000"],
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
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#8b7cff]">FORGE X</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight">Launch</h1>
            </div>
          </div>
          <WalletButton />
        </div>

        <SectionTitle
          eyebrow="Launch"
          title="Launch your token."
        />

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {steps.map(([n, t]) => (
            <Card key={n}>
              <span className="text-xs font-bold text-[#8b7cff]">{n}</span>
              <h2 className="mt-5 text-xl font-bold">{t}</h2>
              
            </Card>
          ))}
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_.8fr]">
          <div>
            <div className="mb-3 rounded-xl border border-white/10 bg-white/[.02] p-1">
              <div className="rounded-lg bg-[#8b7cff] px-4 py-3 text-center text-sm font-bold text-black">Fair Launch</div>
            </div>
            <TokenLaunchSigner />
          </div>

          <Card>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8b7cff]">Protocol rules</p>
            <div className="mt-5 space-y-3">
              {rules.map(([a, b]) => (
                <div key={a} className="flex items-center justify-between border-b border-white/10 pb-3 text-sm">
                  <span className="text-white/45">{a}</span><span className="font-bold">{b}</span>
                </div>
              ))}
            </div>
            <div className="hidden mt-5 rounded-xl border border-[#8b7cff]/15 bg-[#8b7cff]/5 p-4 text-xs leading-5 text-white/55">
              Fair Launch requires mint authority, freeze authority and metadata update authority to be revoked, with metadata made immutable in the launch transaction.
            </div>
            
          </Card>
        </div>
      </main>
    </Shell>
  );
}
