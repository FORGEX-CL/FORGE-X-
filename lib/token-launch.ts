import { Connection, PublicKey, SystemProgram, Transaction, Keypair } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, createInitializeMintInstruction, createMintToInstruction, createSetAuthorityInstruction, AuthorityType, getMinimumBalanceForRentExemptMint } from "@solana/spl-token";

export type TokenLaunchConfig = { name: string; symbol: string; decimals: number; supply: bigint; revokeMintAuthority: boolean; revokeFreezeAuthority: boolean };

export async function buildTokenLaunchTransaction(connection: Connection, payer: PublicKey, config: TokenLaunchConfig) {
  if (!/^[A-Z0-9]{1,10}$/.test(config.symbol)) throw new Error("Symbol must be 1-10 uppercase letters/numbers");
  if (!config.name.trim()) throw new Error("Token name is required");
  if (!Number.isInteger(config.decimals) || config.decimals < 0 || config.decimals > 9) throw new Error("Decimals must be 0-9");
  if (config.supply <= 0n) throw new Error("Supply must be greater than zero");
  const mint = Keypair.generate();
  const ata = await PublicKey.findProgramAddress([payer.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.publicKey.toBuffer()], ASSOCIATED_TOKEN_PROGRAM_ID);
  const rent = await getMinimumBalanceForRentExemptMint(connection);
  const rawSupply = config.supply * (10n ** BigInt(config.decimals));
  if (rawSupply > 18446744073709551615n) throw new Error("Supply exceeds SPL token limit");
  const tx = new Transaction().add(
    SystemProgram.createAccount({ fromPubkey: payer, newAccountPubkey: mint.publicKey, space: 82, lamports: rent, programId: TOKEN_PROGRAM_ID }),
    createInitializeMintInstruction(mint.publicKey, config.decimals, payer, config.revokeFreezeAuthority ? null : payer, TOKEN_PROGRAM_ID),
    createAssociatedTokenAccountInstruction(payer, ata[0], payer, mint.publicKey, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID),
    createMintToInstruction(mint.publicKey, ata[0], payer, rawSupply, [], TOKEN_PROGRAM_ID),
    ...(config.revokeMintAuthority ? [createSetAuthorityInstruction(mint.publicKey, payer, AuthorityType.MintTokens, null, [], TOKEN_PROGRAM_ID)] : []),
    ...(config.revokeFreezeAuthority ? [createSetAuthorityInstruction(mint.publicKey, payer, AuthorityType.FreezeAccount, null, [], TOKEN_PROGRAM_ID)] : [])
  );
  tx.feePayer = payer;
  const latest = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = latest.blockhash;
  tx.partialSign(mint);
  return { transaction: tx, mint: mint.publicKey.toBase58(), associatedTokenAccount: ata[0].toBase58(), lastValidBlockHeight: latest.lastValidBlockHeight };
}
