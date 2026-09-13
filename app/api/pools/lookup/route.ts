import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { CREATE_CPMM_POOL_PROGRAM, DEVNET_PROGRAM_ID, PoolFetchType, Raydium } from "@raydium-io/raydium-sdk-v2";

const RPC = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const WSOL = "So11111111111111111111111111111111111111112";
type MintLike = { address?: string; symbol?: string; decimals?: number } | string;
type PoolLike = { id?: string; programId?: string; mintA?: MintLike; mintB?: MintLike; price?: number; tvl?: number; feeRate?: number; day?: { volume?: number; apr?: number }; openTime?: number };
function cluster() { return (process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "devnet") as "mainnet-beta" | "devnet" | "testnet"; }
function address(value: MintLike | undefined) { return typeof value === "string" ? value : value?.address; }
function symbol(value: MintLike | undefined) { return typeof value === "string" ? null : value?.symbol ?? null; }
function decimals(value: MintLike | undefined) { return typeof value === "string" ? null : value?.decimals ?? null; }
function isPoolLike(value: unknown): value is PoolLike { return typeof value === "object" && value !== null; }
export async function GET(request: NextRequest) {
  try {
    const mintValue = request.nextUrl.searchParams.get("mint"); const poolIdValue = request.nextUrl.searchParams.get("poolId");
    const mint = mintValue ? new PublicKey(mintValue) : null; const poolId = poolIdValue ? new PublicKey(poolIdValue) : null;
    if (!mint && !poolId) throw new Error("Provide a token mint or pool ID");
    const network = cluster(); const connection = new Connection(RPC, "confirmed");
    const expectedProgram = network === "devnet" ? DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM : CREATE_CPMM_POOL_PROGRAM;
    if (network === "devnet" && !poolId) throw new Error("Devnet Raydium pool discovery requires the pool ID; Raydium's mint-list API is mainnet-only");
    const raydium = await Raydium.load({ connection, owner: PublicKey.default, disableLoadToken: true });
    if (poolId) {
      const rpcPool = await raydium.cpmm.getPoolInfoFromRpc(poolId.toBase58()); const info = isPoolLike(rpcPool.poolInfo) ? rpcPool.poolInfo : null;
      if (!info || info.programId !== expectedProgram.toBase58()) throw new Error("Pool is not an expected Raydium CPMM pool on this network");
      const mintA = address(info.mintA); const mintB = address(info.mintB); if (mint && mintA !== mint.toBase58() && mintB !== mint.toBase58()) throw new Error("Pool does not contain the requested token mint");
      return NextResponse.json({ network, verified: true, source: "raydium-rpc", pools: [normalizePool(info, expectedProgram.toBase58())] });
    }
    const response = await raydium.api.fetchPoolByMints({ mint1: mint!.toBase58(), mint2: WSOL, type: PoolFetchType.Standard, sort: "liquidity", order: "desc", page: 1, pageSize: 20 });
    const rawPools: unknown = response.data; const pools = Array.isArray(rawPools) ? rawPools.filter(isPoolLike).filter((pool) => pool.programId === expectedProgram.toBase58()).map((pool) => normalizePool(pool, expectedProgram.toBase58())) : [];
    return NextResponse.json({ network, verified: true, source: "raydium-api", pools });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to discover Raydium pools" }, { status: 400 }); }
}
function normalizePool(pool: PoolLike, expectedProgramId: string) { return { id: pool.id ?? "", programId: pool.programId ?? "", verifiedProgram: pool.programId === expectedProgramId, mintA: address(pool.mintA) ?? null, mintB: address(pool.mintB) ?? null, symbolA: symbol(pool.mintA), symbolB: symbol(pool.mintB), decimalsA: decimals(pool.mintA), decimalsB: decimals(pool.mintB), price: pool.price ?? null, tvl: pool.tvl ?? null, feeRate: pool.feeRate ?? null, volume24h: pool.day?.volume ?? null, apr24h: pool.day?.apr ?? null, openTime: pool.openTime ?? null }; }
