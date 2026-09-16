import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { AccountLayout, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Raydium } from "@raydium-io/raydium-sdk-v2";
import { RAYDIUM_CPMM_PROGRAM_ID, SOLANA_CLUSTER, SOLANA_RPC_URL } from "../../../../../../lib/solana-client-config";

const WSOL = new PublicKey("So11111111111111111111111111111111111111112");

function bad(error: string, status = 400) {
  return NextResponse.json({ verified: false, error }, { status });
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const walletText = params.get("wallet") || "";
  const mintText = params.get("mint") || "";
  const poolIdText = params.get("poolId") || "";

  let wallet: PublicKey;
  let mint: PublicKey;
  let poolId: PublicKey;
  try {
    wallet = new PublicKey(walletText);
    mint = new PublicKey(mintText);
    poolId = new PublicKey(poolIdText);
  } catch {
    return bad("Wallet, token mint, and pool ID must be valid Solana public keys");
  }

  if (mint.equals(WSOL)) return bad("LP position verification requires a non-WSOL token mint");

  try {
    const connection = new Connection(SOLANA_RPC_URL, "confirmed");
    const poolAccount = await connection.getAccountInfo(poolId, "confirmed");
    if (!poolAccount) return bad("Raydium CPMM pool account was not found");
    if (!poolAccount.owner.equals(new PublicKey(RAYDIUM_CPMM_PROGRAM_ID))) {
      return bad("Pool account is not owned by the configured Raydium CPMM program");
    }

    const raydium = await Raydium.load({ owner: wallet, connection, cluster: SOLANA_CLUSTER === "devnet" ? "devnet" : "mainnet" });
    const pool = await raydium.cpmm.getPoolInfoFromRpc(poolId.toBase58());
    const poolInfo = pool.poolInfo;

    if (poolInfo.programId !== RAYDIUM_CPMM_PROGRAM_ID) return bad("Raydium returned an unexpected CPMM program");
    const mintA = new PublicKey(poolInfo.mintA.address);
    const mintB = new PublicKey(poolInfo.mintB.address);
    if (!((mintA.equals(mint) && mintB.equals(WSOL)) || (mintB.equals(mint) && mintA.equals(WSOL)))) {
      return bad("Verified pool does not contain the requested token and canonical WSOL");
    }

    const lpMint = new PublicKey(poolInfo.lpMint.address);
    const lpMintAccount = await connection.getAccountInfo(lpMint, "confirmed");
    if (!lpMintAccount) return bad("CPMM LP mint account was not found");
    if (!lpMintAccount.owner.equals(TOKEN_PROGRAM_ID)) return bad("CPMM LP mint is not owned by the legacy SPL Token program");

    const accounts = await connection.getParsedTokenAccountsByOwner(wallet, { mint: lpMint }, "confirmed");
    let walletLpBalance = 0n;
    let lpDecimals: number | undefined;
    for (const account of accounts.value) {
      const tokenAmount = account.account.data.parsed?.info?.tokenAmount;
      if (typeof tokenAmount?.amount === "string" && /^\d+$/.test(tokenAmount.amount)) walletLpBalance += BigInt(tokenAmount.amount);
      if (typeof tokenAmount?.decimals === "number") lpDecimals = tokenAmount.decimals;
    }

    if (lpDecimals === undefined) {
      const mintInfo = await connection.getParsedAccountInfo(lpMint, "confirmed");
      const parsed = mintInfo.value?.data;
      if (!parsed || !("parsed" in parsed)) return bad("Unable to read CPMM LP mint decimals");
      const decimals = (parsed as { parsed: { info: { decimals?: number } } }).parsed.info.decimals;
      if (typeof decimals !== "number") return bad("Unable to read CPMM LP mint decimals");
      lpDecimals = decimals;
    }

    const vaultA = new PublicKey(pool.poolKeys.vault.A);
    const vaultB = new PublicKey(pool.poolKeys.vault.B);
    const vaultAccounts = await connection.getMultipleAccountsInfo([vaultA, vaultB], "confirmed");
    if (!vaultAccounts[0] || !vaultAccounts[1]) return bad("CPMM vault accounts could not be read");
    if (!vaultAccounts[0].owner.equals(TOKEN_PROGRAM_ID) || !vaultAccounts[1].owner.equals(TOKEN_PROGRAM_ID)) {
      return bad("CPMM vault accounts are not owned by the legacy SPL Token program");
    }
    if (vaultAccounts[0].data.length !== AccountLayout.span || vaultAccounts[1].data.length !== AccountLayout.span) {
      return bad("CPMM vault accounts have an unexpected SPL Token account layout");
    }

    const decodedVaultA = AccountLayout.decode(vaultAccounts[0].data);
    const decodedVaultB = AccountLayout.decode(vaultAccounts[1].data);
    if (!decodedVaultA.mint.equals(mintA) || !decodedVaultB.mint.equals(mintB)) {
      return bad("CPMM vault mints do not match the verified pool mint pair");
    }

    return NextResponse.json({
      verified: true,
      wallet: wallet.toBase58(),
      mint: mint.toBase58(),
      poolId: poolId.toBase58(),
      lpMint: lpMint.toBase58(),
      lpDecimals,
      walletLpBalance: walletLpBalance.toString(),
      walletLpBalanceUi: Number(walletLpBalance) / 10 ** lpDecimals,
      vaultA: vaultA.toBase58(),
      vaultB: vaultB.toBase58(),
      hasLiveVaultAccounts: true,
    });
  } catch (error) {
    return bad(error instanceof Error ? error.message : "Unable to verify the Raydium CPMM LP position", 502);
  }
}
