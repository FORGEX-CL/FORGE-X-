import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { getWallets } from "@wallet-standard/app";

type SignableTransaction = Transaction | VersionedTransaction;

type StandardAccount = { address: string; chains?: readonly string[] };
type StandardWallet = {
  name: string;
  icon: string;
  chains: readonly string[];
  accounts: readonly StandardAccount[];
  features: Record<string, unknown>;
};

export type SolanaWalletProvider = {
  publicKey?: PublicKey | null;
  connect: () => Promise<{ publicKey?: PublicKey }>;
  disconnect?: () => Promise<void>;
  signTransaction?: <T extends SignableTransaction>(transaction: T) => Promise<T>;
};

let activeWallet: StandardWallet | null = null;
let activeAccount: StandardAccount | null = null;
let mobileRegistrationPromise: Promise<void> | null = null;

function chainId() {
  return process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "mainnet-beta" ? "solana:mainnet" : "solana:devnet";
}

async function ensureMobileWalletRegistration() {
  if (typeof window === "undefined") return;
  if (!mobileRegistrationPromise) {
    mobileRegistrationPromise = import("@solana-mobile/wallet-standard-mobile")
      .then(({ registerMwa, createDefaultAuthorizationCache, createDefaultChainSelector, createDefaultWalletNotFoundHandler }) => {
        registerMwa({
          appIdentity: {
            name: "FORGE X",
            uri: window.location.origin,
            icon: "/forge-icon.svg",
          },
          authorizationCache: createDefaultAuthorizationCache(),
          chains: ["solana:devnet", "solana:mainnet"],
          chainSelector: createDefaultChainSelector(),
          onWalletNotFound: createDefaultWalletNotFoundHandler(),
        });
      })
      .catch(() => undefined);
  }
  await mobileRegistrationPromise;
}

function isSolanaWallet(wallet: StandardWallet) {
  return wallet.chains.some((chain) => chain.startsWith("solana:")) && Boolean(wallet.features["standard:connect"]);
}

function selectedChain(account?: StandardAccount) {
  const preferred = chainId();
  if (account?.chains?.includes(preferred)) return preferred;
  return preferred;
}

function createCompatProvider(wallet: StandardWallet, account: StandardAccount): SolanaWalletProvider {
  const provider: SolanaWalletProvider = {
    get publicKey() {
      try {
        return new PublicKey(account.address);
      } catch {
        return null;
      }
    },
    async connect() {
      const connectFeature = wallet.features["standard:connect"] as { connect: (options?: { silent?: boolean }) => Promise<{ accounts: readonly StandardAccount[] }> };
      const result = await connectFeature.connect();
      const next = result.accounts?.[0] as StandardAccount | undefined;
      if (!next) throw new Error("Wallet connected without a Solana account");
      activeWallet = wallet;
      activeAccount = next;
      return { publicKey: new PublicKey(next.address) };
    },
    async disconnect() {
      const disconnectFeature = wallet.features["standard:disconnect"] as { disconnect?: () => Promise<void> } | undefined;
      if (disconnectFeature?.disconnect) await disconnectFeature.disconnect();
      activeWallet = null;
      activeAccount = null;
      if (typeof window !== "undefined") delete (window as Window & { solana?: unknown }).solana;
    },
    async signTransaction<T extends SignableTransaction>(transaction: T) {
      const signFeature = wallet.features["solana:signTransaction"] as { signTransaction: (input: { account: StandardAccount; transaction: Uint8Array; chain: string }) => Promise<readonly [{ signedTransaction: Uint8Array }]> } | undefined;
      if (!signFeature?.signTransaction) throw new Error("Connected wallet does not support transaction signing");
      const bytes = transaction instanceof Transaction
        ? transaction.serialize({ requireAllSignatures: false, verifySignatures: false })
        : transaction.serialize();
      const [result] = await signFeature.signTransaction({
        account,
        transaction: new Uint8Array(bytes),
        chain: selectedChain(account),
      });
      if (!result?.signedTransaction) throw new Error("Wallet did not return a signed transaction");
      if (transaction instanceof Transaction) return Transaction.from(result.signedTransaction) as T;
      return VersionedTransaction.deserialize(result.signedTransaction) as T;
    },
  };
  return provider;
}

function exposeCompatProvider(wallet: StandardWallet, account: StandardAccount) {
  const provider = createCompatProvider(wallet, account);
  if (typeof window !== "undefined") {
    (window as Window & { solana?: SolanaWalletProvider }).solana = provider;
  }
  return provider;
}

export async function listSolanaWallets(): Promise<StandardWallet[]> {
  await ensureMobileWalletRegistration();
  return getWallets().get().filter(isSolanaWallet) as StandardWallet[];
}

export async function connectWallet(wallet?: StandardWallet) {
  if (activeWallet && activeAccount) return exposeCompatProvider(activeWallet, activeAccount);

  const candidates = await listSolanaWallets();
  const target = wallet ?? candidates[0];
  if (target) {
    const connectFeature = target.features["standard:connect"] as { connect: (options?: { silent?: boolean }) => Promise<{ accounts: readonly StandardAccount[] }> };
    const result = await connectFeature.connect();
    const account = result.accounts?.[0] as StandardAccount | undefined;
    if (!account) throw new Error("Wallet connected without a Solana account");
    activeWallet = target;
    activeAccount = account;
    return exposeCompatProvider(target, account);
  }

  const injected = typeof window !== "undefined" ? (window as Window & { solana?: SolanaWalletProvider }).solana : undefined;
  if (injected?.connect) {
    const result = await injected.connect();
    if (result.publicKey) return injected;
  }

  throw new Error("No compatible Solana wallet found. Install Phantom, Solflare, Backpack, or a Mobile Wallet Adapter wallet.");
}

export function getBrowserWallet(): SolanaWalletProvider {
  if (typeof window === "undefined") throw new Error("Wallet is only available in the browser");
  if (activeWallet && activeAccount) return exposeCompatProvider(activeWallet, activeAccount);
  const provider = (window as Window & { solana?: SolanaWalletProvider }).solana;
  if (!provider?.connect) throw new Error("No compatible Solana wallet found");
  return provider;
}

export function assertWalletCanSign(provider: SolanaWalletProvider): asserts provider is SolanaWalletProvider & { signTransaction: <T extends SignableTransaction>(transaction: T) => Promise<T> } {
  if (!provider.signTransaction) throw new Error("Connected wallet does not support transaction signing");
}

export async function connectBrowserWallet() {
  const provider = await connectWallet();
  const address = provider.publicKey?.toBase58();
  if (!address) throw new Error("Wallet connected without a public key");
  return { provider, address };
}

export async function disconnectBrowserWallet() {
  const provider = getBrowserWallet();
  if (provider.disconnect) await provider.disconnect();
  else if (typeof window !== "undefined") {
    await provider.connect().catch(() => undefined);
    delete (window as Window & { solana?: unknown }).solana;
  }
}

export function getActiveWalletAddress() {
  return activeAccount?.address ?? (typeof window !== "undefined" ? (window as Window & { solana?: SolanaWalletProvider }).solana?.publicKey?.toBase58() ?? null : null);
}

export type { StandardWallet };
