import { Shell, SectionTitle } from "../components/Shell";
import { WalletPortfolio } from "../components/WalletPortfolio";

export default function Portfolio() {
  return (
    <Shell>
      <main className="mx-auto max-w-6xl px-5 py-12 lg:px-8">
        <SectionTitle eyebrow="Portfolio" title="Your on-chain view." text="Real wallet balances and SPL Token positions read directly from Solana RPC. FORGE X does not invent portfolio values." />
        <WalletPortfolio />
      </main>
    </Shell>
  );
}
