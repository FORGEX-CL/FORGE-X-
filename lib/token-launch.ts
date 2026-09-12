import { Connection, PublicKey, SystemProgram, Transaction, Keypair } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  AuthorityType,
  getMinimumBalanceForRentExemptMint,
} from "@solana/spl-token";
import { createV1, updateV1, mplTokenMetadata, TokenStandard } from "@metaplex-foundation/mpl-token-metadata";
import { createNoopSigner, publicKey, signerIdentity, signerPayer, percentAmount } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { fromWeb3JsPublicKey, toWeb3JsInstruction } from "@metaplex-foundation/umi-web3js-adapters";

export type TokenLaunchConfig = {
  name: string;
  symbol: string;
  decimals: number;
  supply: bigint;
  metadataUri: string;
  revokeMintAuthority: boolean;
  revokeFreezeAuthority: boolean;
};

export async function buildTokenLaunchTransaction(
  connection: Connection,
  payer: PublicKey,
  config: TokenLaunchConfig,
) {
  if (!/^[A-Z0-9]{1,10}$/.test(config.symbol)) throw new Error("Symbol must be 1-10 uppercase letters/numbers");
  if (!config.name.trim()) throw new Error("Token name is required");
  if (config.name.length > 32) throw new Error("Token name must be 32 characters or fewer");
  if (!config.metadataUri.trim()) throw new Error("Metadata URI is required");
  if (config.metadataUri.length > 200) throw new Error("Metadata URI is too long");
  if (!Number.isInteger(config.decimals) || config.decimals < 0 || config.decimals > 9) throw new Error("Decimals must be 0-9");
  if (config.supply <= 0n) throw new Error("Supply must be greater than zero");
  if (!config.revokeMintAuthority || !config.revokeFreezeAuthority) {
    throw new Error("FORGE X launch requires mint and freeze authority revocation");
  }

  const mint = Keypair.generate();
  const ata = await PublicKey.findProgramAddress(
    [payer.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.publicKey.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const rent = await getMinimumBalanceForRentExemptMint(connection);
  const rawSupply = config.supply * 10n ** BigInt(config.decimals);
  if (rawSupply > 18446744073709551615n) throw new Error("Supply exceeds SPL token limit");

  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: mint.publicKey,
      space: 82,
      lamports: rent,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMintInstruction(mint.publicKey, config.decimals, payer, null, TOKEN_PROGRAM_ID),
    createAssociatedTokenAccountInstruction(
      payer,
      ata[0],
      payer,
      mint.publicKey,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    ),
    createMintToInstruction(mint.publicKey, ata[0], payer, rawSupply, [], TOKEN_PROGRAM_ID),
    createSetAuthorityInstruction(mint.publicKey, payer, AuthorityType.MintTokens, null, [], TOKEN_PROGRAM_ID),
    createSetAuthorityInstruction(mint.publicKey, payer, AuthorityType.FreezeAccount, null, [], TOKEN_PROGRAM_ID),
  );

  // Build current Metaplex Token Metadata instructions without possessing the user's secret key.
  // A noop signer makes the payer/update-authority signature an explicit requirement of the final wallet prompt.
  const umi = createUmi(connection.rpcEndpoint, "confirmed").use(mplTokenMetadata());
  const walletSigner = createNoopSigner(fromWeb3JsPublicKey(payer));
  const mintSigner = createNoopSigner(fromWeb3JsPublicKey(mint.publicKey));
  umi.use(signerIdentity(walletSigner, false));
  umi.use(signerPayer(walletSigner));

  const metadataCreate = createV1(umi, {
    mint: mintSigner,
    authority: walletSigner,
    payer: walletSigner,
    updateAuthority: publicKey(payer.toBase58()),
    name: config.name.trim(),
    symbol: config.symbol,
    uri: config.metadataUri.trim(),
    sellerFeeBasisPoints: percentAmount(0),
    tokenStandard: TokenStandard.Fungible,
    // The metadata must be mutable during this transaction so updateV1 can atomically
    // remove the update authority and make the account permanently immutable.
    isMutable: true,
    creators: null,
    collectionDetails: null,
    decimals: config.decimals,
    printSupply: null,
  }).getInstructions().map(toWeb3JsInstruction);

  const metadataFinalize = updateV1(umi, {
    mint: publicKey(mint.publicKey.toBase58()),
    authority: walletSigner,
    payer: walletSigner,
    newUpdateAuthority: publicKey(PublicKey.default.toBase58()),
    isMutable: false,
  }).getInstructions().map(toWeb3JsInstruction);

  tx.add(...metadataCreate, ...metadataFinalize);
  tx.feePayer = payer;
  const latest = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = latest.blockhash;
  tx.lastValidBlockHeight = latest.lastValidBlockHeight;
  tx.partialSign(mint);

  return {
    transaction: tx,
    mint: mint.publicKey.toBase58(),
    mintKeypair: mint,
    associatedTokenAccount: ata[0].toBase58(),
    lastValidBlockHeight: latest.lastValidBlockHeight,
    metadataImmutable: true,
    metadataUpdateAuthorityRevoked: true,
  };
}
