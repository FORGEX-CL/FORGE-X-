import { Shell, SectionTitle, Card } from "../components/Shell";
import { FairLaunchGraduator } from "../components/FairLaunchGraduator";
import { PoolDiscovery } from "../components/PoolDiscovery";

export default function Pools() {
  return (
    <Shell>
      <main className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
        <SectionTitle
          eyebrow="Pools"
          title="Liquidity, verified on-chain."
          text="FORGE X uses on-chain state and Raydium CPMM verification rather than fabricated pool metrics. Graduated Fair Launches can be migrated atomically from here."
        />
        <FairLaunchGraduator />
        <div className="mt-5 space-y-5">
          <PoolDiscovery />
          <Card>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#f5c542]">Security rule</p>
            <h2 className="mt-2 text-xl font-black">No “verified” without chain proof</h2>
            <p className="mt-2 text-sm leading-6 text-white/45">A successful wallet signature is not enough. Graduation requires the Fair Launch state to be MIGRATED and the resulting pool account to be owned by the expected Raydium CPMM program. Pool discovery applies the same verification rule.</p>
          </Card>
        </div>
      </main>
    </Shell>
  );
}
