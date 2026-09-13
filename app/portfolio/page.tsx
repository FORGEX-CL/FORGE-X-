import { Shell, SectionTitle } from "../components/Shell";
import { WalletPortfolio } from "../components/WalletPortfolio";
import { WalletActivity } from "../components/WalletActivity";

export default function Portfolio() {
  return (
    <Shell>
      <main className="mx-auto max-w-6xl space-y-8 px-5 py-12 lg:px-8">
        <SectionTitle eyebrow="Portfolio" title="Your on-chain view." text="Real wallet balances, SPL Token positions, and confirmed activity read directly from Solana RPC. FORGE X does not invent portfolio data." />
        <WalletPortfolio />
        <WalletActivity />
      </main>
    </Shell>
  );
}
