import { Shell, SectionTitle, Card } from "../components/Shell";
import { FairLaunchGraduator } from "../components/FairLaunchGraduator";

export default function Pools() {
  return (
    <Shell>
      <main className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
        <SectionTitle
          eyebrow="Pools"
          title="Liquidity, verified on-chain."
          text="FORGE X uses on-chain state and Raydium CPMM verification rather than showing fabricated pool metrics. Graduated Fair Launches can be migrated atomically from here."
        />
        <FairLaunchGraduator />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Card>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#f5c542]">Pool discovery</p>
            <h2 className="mt-2 text-xl font-black">Verified pools are coming next</h2>
            <p className="mt-2 text-sm leading-6 text-white/45">The pool index will be populated from Raydium RPC/API data and verified against the expected CPMM program. Until that index is wired, FORGE X deliberately does not display fake TVL, APR, or volume figures.</p>
          </Card>
          <Card>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#f5c542]">Security rule</p>
            <h2 className="mt-2 text-xl font-black">No “verified” without chain proof</h2>
            <p className="mt-2 text-sm leading-6 text-white/45">A successful wallet signature is not enough. Graduation now requires the Fair Launch state to be MIGRATED and the resulting pool account to be owned by the expected Raydium CPMM program.</p>
          </Card>
        </div>
      </main>
    </Shell>
  );
}
