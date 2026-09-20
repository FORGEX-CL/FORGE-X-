"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AddressLookupTableAccount, Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";

const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "mainnet-beta" ? "mainnet-beta" : "devnet";
const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || (CLUSTER === "devnet" ? "https://api.devnet.solana.com" : "");
const WSOL = "So11111111111111111111111111111111111111112";
const MAINNET_CPMM_PROGRAM = "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C";
const DEVNET_CPMM_PROGRAM = "DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpY";
const EXPECTED_CPMM_PROGRAM = CLUSTER === "mainnet-beta" ? MAINNET_CPMM_PROGRAM : DEVNET_CPMM_PROGRAM;
const SPL_TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const ASSOCIATED_TOKEN_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const COMPUTE_BUDGET_PROGRAM = "ComputeBudget111111111111111111111111111111";
const POLL_MS = 500;
const TIMEOUT_MS = 90_000;
const MAX_SLIPPAGE_PERCENT = 5;
const SWAP_BASE_INPUT_DISCRIMINATOR = [143, 190, 90, 218, 196, 30, 51, 222];

type MintInfo = { address: string; symbol: string | null; decimals: number | null };
type PoolResponse = { pools?: Array<{ id: string; mintA: string | null; mintB: string | null; symbolA: string | null; symbolB: string | null; decimalsA: number | null; decimalsB: number | null; price: number | null }>; error?: string };
type Wallet = { publicKey?: { toString(): string } | null; signTransaction?: (tx: VersionedTransaction) => Promise<VersionedTransaction> };
type PreparedSwap = { transaction?: string; recentBlockhash?: string; lastValidBlockHeight?: number; poolId?: string; inputMint?: string; outputMint?: string; programId?: string; authority?: string; configId?: string; inputVault?: string; outputVault?: string; inputTokenProgram?: string; outputTokenProgram?: string; observationId?: string; outputAmount?: string; minimumOutputAmount?: string; tradeFee?: string; error?: string };

function wallet(): Wallet { return (window as Window & { solana?: Wallet }).solana || {}; }
function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function decodeBase64(value: string): Uint8Array {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function parseUnits(value: string, decimals: number): bigint {
  const normalized = value.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) throw new Error("Enter a valid amount");
  const [whole, fraction = ""] = normalized.split(".");
  if (fraction.length > decimals) throw new Error(`Maximum ${decimals} decimal places allowed`);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt((fraction + "0".repeat(decimals)).slice(0, decimals) || "0");
}
function formatUnits(raw: string, decimals: number): string {
  const value = BigInt(raw); const unit = 10n ** BigInt(decimals); const whole = value / unit;
  const fraction = (value % unit).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}
function readU64(data: Uint8Array, offset: number): bigint {
  let value = 0n;
  for (let i = 0; i < 8; i += 1) value |= BigInt(data[offset + i] || 0) << BigInt(i * 8);
  return value;
}
async function verifyClientTokenAccount(
  connection: Connection,
  accountKey: PublicKey,
  expectedMint: string,
  expectedProgram: string,
  expectedOwner: string,
  role: "input" | "output",
) {
  const account = await connection.getParsedAccountInfo(accountKey, { commitment: "confirmed" });
  if (!account.value) {
    if (role === "output") return;
    throw new Error(`Prepared swap ${role} token account does not exist.`);
  }
  if (account.value.owner.toBase58() !== expectedProgram) {
    throw new Error(`Prepared swap ${role} token account uses an unexpected token program.`);
  }
  const data = account.value.data as { program?: string; parsed?: { info?: { mint?: string; owner?: string } } };
  if (data.program !== "spl-token" && data.program !== "spl-token-2022") {
    throw new Error(`Prepared swap ${role} account is not a parsed SPL token account.`);
  }
  const info = data.parsed?.info;
  if (info?.mint !== expectedMint || info.owner !== expectedOwner) {
    throw new Error(`Prepared swap ${role} token account is not owned by the connected wallet for the expected mint.`);
  }
}
async function auditClientTransaction(
  connection: Connection,
  transaction: VersionedTransaction,
  expectedInputAmount: bigint,
  expectedMinimumOutput: bigint,
  payer: string,
  expected: {
    authority: string;
    configId: string;
    inputVault: string;
    outputVault: string;
    inputTokenProgram: string;
    outputTokenProgram: string;
    inputMint: string;
    outputMint: string;
    poolId: string;
    observationId: string;
  },
) {
  if (transaction.message.version !== 0) throw new Error("Prepared swap is not a V0 transaction.");
  if (transaction.message.staticAccountKeys[0]?.toBase58() !== payer) throw new Error("Prepared swap wallet does not match the connected wallet.");

  const lookupAccounts: AddressLookupTableAccount[] = [];
  for (const lookup of transaction.message.addressTableLookups) {
    const result = await connection.getAddressLookupTable(lookup.accountKey, { commitment: "confirmed" });
    if (!result.value) throw new Error("Prepared swap references an unavailable address lookup table.");
    lookupAccounts.push(result.value);
  }
  const accountKeys = transaction.message.getAccountKeys({ addressLookupTableAccounts: lookupAccounts });
  const resolvedKeys = [
    ...accountKeys.staticAccountKeys,
    ...(accountKeys.accountKeysFromLookups?.writable ?? []),
    ...(accountKeys.accountKeysFromLookups?.readonly ?? []),
  ];

  const programs = transaction.message.compiledInstructions
    .map((instruction) => resolvedKeys[instruction.programIdIndex]?.toBase58())
    .filter(Boolean) as string[];
  const allowedPrograms = new Set([EXPECTED_CPMM_PROGRAM, SPL_TOKEN_PROGRAM, TOKEN_2022_PROGRAM, ASSOCIATED_TOKEN_PROGRAM, SYSTEM_PROGRAM, COMPUTE_BUDGET_PROGRAM]);
  if (programs.some((program) => !allowedPrograms.has(program))) throw new Error("Prepared swap contains an unexpected program instruction.");

  const cpmm = transaction.message.compiledInstructions.filter(
    (instruction) => resolvedKeys[instruction.programIdIndex]?.toBase58() === EXPECTED_CPMM_PROGRAM,
  );
  if (cpmm.length !== 1) throw new Error("Prepared swap must contain exactly one Raydium CPMM instruction.");
  const instruction = cpmm[0];
  if (instruction.accountKeyIndexes.length !== 13) throw new Error("Prepared swap has unexpected Raydium account wiring.");
  if (instruction.data.length !== 24) throw new Error("Prepared swap has unexpected Raydium instruction data.");
  if (!SWAP_BASE_INPUT_DISCRIMINATOR.every((value, index) => instruction.data[index] === value)) throw new Error("Prepared transaction is not a swap-base-input instruction.");
  if (readU64(instruction.data, 8) !== expectedInputAmount || readU64(instruction.data, 16) !== expectedMinimumOutput) {
    throw new Error("Prepared transaction amounts do not match the server quote.");
  }
  if (instruction.accountKeyIndexes[0] !== 0) throw new Error("Prepared Raydium swap payer is not the connected wallet.");

  const keys = instruction.accountKeyIndexes.map((index) => resolvedKeys[index]);
  if (keys.some((key) => !key)) throw new Error("Prepared swap contains an unresolved Raydium account.");
  const expectedKeys = [
    payer,
    expected.authority,
    expected.configId,
    expected.poolId,
    expected.inputMint,
    expected.outputMint,
    expected.inputVault,
    expected.outputVault,
    expected.inputTokenProgram,
    expected.outputTokenProgram,
    expected.inputMint,
    expected.outputMint,
    expected.observationId,
  ];
  // Index 4/5 are user token accounts, so verify every deterministic pool/program key
  // while leaving only the two wallet-owned token accounts variable.
  for (const index of [0, 1, 2, 3, 6, 7, 8, 9, 10, 11, 12]) {
    if (keys[index]!.toBase58() !== expectedKeys[index]) {
      throw new Error(`Prepared Raydium account ${index} does not match the server-verified pool wiring.`);
    }
  }
  if (keys[4]!.equals(keys[5]!)) throw new Error("Prepared swap input and output token accounts must differ.");
  await Promise.all([
    verifyClientTokenAccount(connection, keys[4]!, expected.inputMint, expected.inputTokenProgram, payer, "input"),
    verifyClientTokenAccount(connection, keys[5]!, expected.outputMint, expected.outputTokenProgram, payer, "output"),
  ]);
}
async function waitFor(connection: Connection, signature: string, lastValidBlockHeight: number) {
  const started = Date.now();
  while (Date.now() - started < TIMEOUT_MS) {
    const status = (await connection.getSignatureStatuses([signature], { searchTransactionHistory: true })).value[0];
    if (status?.err) throw new Error(`Swap failed: ${JSON.stringify(status.err)}`);
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return;
    const blockHeight = await connection.getBlockHeight("confirmed");
    if (blockHeight > lastValidBlockHeight) throw new Error("Swap transaction expired before confirmation");
    await sleep(POLL_MS);
  }
  throw new Error("Timed out waiting for swap confirmation");
}

export function RaydiumCpmmTrader() {
  const searchParams = useSearchParams();
  const queryPool = searchParams.get("pool") || "";
  const queryInputMint = searchParams.get("inputMint") || WSOL;
  const [poolId, setPoolId] = useState(queryPool);
  const [mints, setMints] = useState<MintInfo[]>([]);
  const [inputMint, setInputMint] = useState(queryInputMint);
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState("0.5");
  const [quote, setQuote] = useState<{ outputAmount: string; minimumOutputAmount: string; tradeFee: string; outputMint: string } | null>(null);
  const [status, setStatus] = useState("idle");
  const [signature, setSignature] = useState("");
  const [error, setError] = useState("");
  const [loadingPool, setLoadingPool] = useState(false);

  const input = mints.find((mint) => mint.address === inputMint);
  const output = mints.find((mint) => mint.address !== inputMint);

  useEffect(() => {
    if (!poolId.trim()) return;
    const timer = setTimeout(async () => {
      setLoadingPool(true); setError("");
      try {
        const response = await fetch(`/api/pools/lookup?poolId=${encodeURIComponent(poolId.trim())}`);
        const data = await response.json() as PoolResponse;
        if (!response.ok || !data.pools?.[0]) throw new Error(data.error || "Unable to verify pool");
        const pool = data.pools[0];
        const nextMints: MintInfo[] = [
          { address: pool.mintA || "", symbol: pool.symbolA, decimals: pool.decimalsA },
          { address: pool.mintB || "", symbol: pool.symbolB, decimals: pool.decimalsB },
        ].filter((mint) => mint.address && mint.decimals !== null);
        if (nextMints.length !== 2) throw new Error("Pool mint metadata is incomplete");
        setMints(nextMints);
        setInputMint((current) => nextMints.some((mint) => mint.address === current) ? current : nextMints[0].address);
      } catch (e) { setMints([]); setError(e instanceof Error ? e.message : "Unable to verify pool"); }
      finally { setLoadingPool(false); }
    }, 200);
    return () => clearTimeout(timer);
  }, [poolId]);

  async function swap() {
    const w = wallet();
    if (!RPC) { setError("Mainnet trading requires a configured NEXT_PUBLIC_SOLANA_RPC_URL."); return; }
    if (!w.publicKey || !w.signTransaction) { setError("Connect a Solana wallet first."); return; }
    if (!poolId.trim() || !input || !output) { setError("Enter a verified Raydium CPMM pool."); return; }
    if (!amount.trim()) { setError("Enter a swap amount."); return; }
    const slippagePercent = Number(slippage);
    if (!Number.isFinite(slippagePercent) || slippagePercent < 0.01 || slippagePercent > MAX_SLIPPAGE_PERCENT) {
      setError(`Slippage must be between 0.01% and ${MAX_SLIPPAGE_PERCENT}%`); return;
    }
    setError(""); setSignature(""); setQuote(null); setStatus("preparing");
    try {
      const rawAmount = parseUnits(amount, input.decimals ?? 9);
      const response = await fetch("/api/raydium/swap/prepare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ poolId: poolId.trim(), trader: w.publicKey.toString(), inputMint, amount: rawAmount.toString(), slippage: slippagePercent / 100 }) });
      const data = await response.json() as PreparedSwap;
      if (!response.ok || !data.transaction || !data.recentBlockhash || typeof data.lastValidBlockHeight !== "number" || !data.outputAmount || !data.minimumOutputAmount || !data.outputMint || !data.poolId || !data.inputMint || !data.programId) throw new Error(data.error || "Unable to prepare Raydium swap");
      if (data.poolId !== poolId.trim()) throw new Error("Prepared swap pool does not match the selected pool.");
      if (data.inputMint !== inputMint) throw new Error("Prepared swap input token does not match the selected token.");
      if (data.outputMint !== output.address) throw new Error("Prepared swap output token does not match the selected pool.");
      if (data.programId !== EXPECTED_CPMM_PROGRAM) throw new Error("Prepared swap uses an unexpected Raydium CPMM program.");
      if (!data.authority || !data.configId || !data.inputVault || !data.outputVault || !data.inputTokenProgram || !data.outputTokenProgram || !data.observationId) throw new Error("Prepared swap verification metadata is incomplete.");

      setQuote({ outputAmount: data.outputAmount, minimumOutputAmount: data.minimumOutputAmount, tradeFee: data.tradeFee || "0", outputMint: data.outputMint });

      const transaction = VersionedTransaction.deserialize(decodeBase64(data.transaction));
      if (transaction.message.recentBlockhash !== data.recentBlockhash) throw new Error("Prepared swap blockhash mismatch. Please try again.");
      const expectedMinimumOutput = BigInt(data.minimumOutputAmount);
      const connection = new Connection(RPC, "confirmed");
      await auditClientTransaction(
        connection,
        transaction,
        rawAmount,
        expectedMinimumOutput,
        w.publicKey.toString(),
        {
          authority: data.authority,
          configId: data.configId,
          inputVault: data.inputVault,
          outputVault: data.outputVault,
          inputTokenProgram: data.inputTokenProgram,
          outputTokenProgram: data.outputTokenProgram,
          inputMint: data.inputMint,
          outputMint: data.outputMint,
          poolId: data.poolId,
          observationId: data.observationId,
        },
      );

      setStatus("signing");
      const blockHeightBeforeSigning = await connection.getBlockHeight("confirmed");
      if (blockHeightBeforeSigning > data.lastValidBlockHeight) throw new Error("Swap transaction expired before wallet approval. Please try again.");
      const signed = await w.signTransaction(transaction);
      const blockHeightAfterSigning = await connection.getBlockHeight("confirmed");
      if (blockHeightAfterSigning > data.lastValidBlockHeight) throw new Error("Swap transaction expired while waiting for wallet approval. Please try again.");
      setStatus("confirming");
      const txid = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 5 });
      setSignature(txid);
      await waitFor(connection, txid, data.lastValidBlockHeight);
      setStatus("confirmed");
    } catch (e) { setStatus("failed"); setError(e instanceof Error ? e.message : "Swap failed"); }
  }

  function flip() {
    if (output) { setInputMint(output.address); setAmount(""); setQuote(null); }
  }

  const outputDecimals = output?.decimals ?? 9;
  return <div className="rounded-2xl border border-white/10 bg-white/[.025] p-6">
    <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#f5c542]">Raydium CPMM</p><h3 className="mt-2 text-xl font-black">Trade a migrated pool</h3></div><span className="rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-wider text-white/45">Verified on-chain</span></div>
    <label className="mt-5 block text-sm text-white/50">Pool ID<input value={poolId} onChange={(e) => setPoolId(e.target.value)} className="forge-input" placeholder="Raydium CPMM pool address" /></label>
    {loadingPool && <p className="mt-3 text-xs text-white/40">Checking pool account…</p>}
    {mints.length === 2 && <>
      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4"><div className="flex items-center justify-between"><span className="text-xs text-white/40">You pay</span><button onClick={flip} className="rounded-lg border border-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/50">Flip</button></div><div className="mt-2 flex items-center gap-3"><input value={amount} onChange={(e) => setAmount(e.target.value)} className="min-w-0 flex-1 bg-transparent text-2xl font-bold outline-none" inputMode="decimal" placeholder="0.00" /><span className="font-bold">{input?.symbol || (inputMint === WSOL ? "SOL" : "TOKEN")}</span></div></div>
      <div className="py-2 text-center text-white/20">↓</div>
      <div className="rounded-xl border border-white/10 bg-black/20 p-4"><span className="text-xs text-white/40">You receive</span><div className="mt-2 flex items-center justify-between gap-3"><span className="text-2xl font-bold text-white/60">{quote ? formatUnits(quote.outputAmount, outputDecimals) : "0.00"}</span><span className="font-bold">{output?.symbol || "TOKEN"}</span></div></div>
      <label className="mt-4 block text-sm text-white/50">Slippage<input value={slippage} onChange={(e) => setSlippage(e.target.value)} className="forge-input" inputMode="decimal" placeholder="0.5" /><span className="mt-1 block text-[11px] text-white/30">Allowed range: 0.01%–5%.</span></label>
      {quote && <div className="mt-4 grid gap-2 rounded-xl border border-white/10 p-4 text-xs text-white/45"><div className="flex justify-between"><span>Minimum received</span><span>{formatUnits(quote.minimumOutputAmount, outputDecimals)} {output?.symbol || "TOKEN"}</span></div><div className="flex justify-between"><span>Pool trade fee</span><span>{formatUnits(quote.tradeFee, input?.decimals ?? 9)} {input?.symbol || "TOKEN"}</span></div></div>}
      <button onClick={swap} disabled={status === "preparing" || status === "signing" || status === "confirming" || loadingPool} className="mt-5 w-full rounded-xl bg-[#f5c542] py-3 font-bold text-black disabled:opacity-40">{status === "preparing" ? "Preparing…" : status === "signing" ? "Approve in wallet…" : status === "confirming" ? "Confirming…" : status === "confirmed" ? "Swap confirmed ✓" : "Swap on Raydium"}</button>
    </>}
    {signature && <a className="mt-3 block break-all text-xs text-[#f5c542]" href={`https://solscan.io/tx/${signature}?cluster=${CLUSTER}`} target="_blank" rel="noreferrer">View transaction</a>}
    {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
  </div>;
}
