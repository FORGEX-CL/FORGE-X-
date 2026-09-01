import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";

export const FORGE_X_FAIR_LAUNCH_PROGRAM_ID = process.env.NEXT_PUBLIC_FORGE_X_PROGRAM_ID
  ? new PublicKey(process.env.NEXT_PUBLIC_FORGE_X_PROGRAM_ID)
  : null;

export const FAIR_LAUNCH_STATE_SEED = "launch";
export const FAIR_LAUNCH_SUPPLY_BASE_UNITS = 1_000_000_000_000_000_000n;
export const FAIR_LAUNCH_DECIMALS = 9;

function u64(value: bigint): Buffer {
  const out = Buffer.alloc(8);
  out.writeBigUInt64LE(value);
  return out;
}

export function fairLaunchStatePda(mint: PublicKey, programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(FAIR_LAUNCH_STATE_SEED), mint.toBuffer()],
    programId,
  )[0];
}

export function fairLaunchVaultAta(mint: PublicKey, programId: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(
    mint,
    fairLaunchStatePda(mint, programId),
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
}

export function buildInitializeFairLaunch(
  mint: PublicKey,
  developer: PublicKey,
  graduationSolLamports: bigint,
  programId = FORGE_X_FAIR_LAUNCH_PROGRAM_ID,
): TransactionInstruction {
  if (!programId) throw new Error("FORGE X Fair Launch program ID is not configured");
  if (graduationSolLamports <= 0n) throw new Error("Graduation target must be positive");
  const state = fairLaunchStatePda(mint, programId);
  const data = Buffer.concat([Buffer.from([0]), developer.toBuffer(), u64(graduationSolLamports)]);
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: state, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: developer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export function buildSeedFairLaunchVault(
  mint: PublicKey,
  developer: PublicKey,
  programId = FORGE_X_FAIR_LAUNCH_PROGRAM_ID,
): TransactionInstruction[] {
  if (!programId) throw new Error("FORGE X Fair Launch program ID is not configured");
  const state = fairLaunchStatePda(mint, programId);
  const vault = fairLaunchVaultAta(mint, programId);
  const developerAta = getAssociatedTokenAddressSync(mint, developer);
  return [
    createAssociatedTokenAccountIdempotentInstruction(
      developer,
      vault,
      state,
      mint,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    ),
    createTransferInstruction(
      developerAta,
      vault,
      developer,
      FAIR_LAUNCH_SUPPLY_BASE_UNITS,
      [],
      TOKEN_PROGRAM_ID,
    ),
  ];
}

export function buildFairLaunchBuy(
  mint: PublicKey,
  buyer: PublicKey,
  grossLamports: bigint,
  feeReceiver: PublicKey,
  programId = FORGE_X_FAIR_LAUNCH_PROGRAM_ID,
): TransactionInstruction {
  if (!programId) throw new Error("FORGE X Fair Launch program ID is not configured");
  if (grossLamports <= 0n) throw new Error("Buy amount must be positive");
  const state = fairLaunchStatePda(mint, programId);
  const vault = fairLaunchVaultAta(mint, programId);
  const buyerAta = getAssociatedTokenAddressSync(mint, buyer);
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: state, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: buyer, isSigner: true, isWritable: true },
      { pubkey: buyerAta, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: feeReceiver, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([Buffer.from([1]), u64(grossLamports)]),
  });
}

export function buildFairLaunchBuyWithAta(
  mint: PublicKey,
  buyer: PublicKey,
  grossLamports: bigint,
  feeReceiver: PublicKey,
  programId = FORGE_X_FAIR_LAUNCH_PROGRAM_ID,
): TransactionInstruction[] {
  const buyerAta = getAssociatedTokenAddressSync(mint, buyer);
  return [
    createAssociatedTokenAccountIdempotentInstruction(
      buyer,
      buyerAta,
      buyer,
      mint,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    ),
    buildFairLaunchBuy(mint, buyer, grossLamports, feeReceiver, programId),
  ];
}

export function buildFairLaunchSell(
  mint: PublicKey,
  seller: PublicKey,
  tokenBaseUnits: bigint,
  feeReceiver: PublicKey,
  programId = FORGE_X_FAIR_LAUNCH_PROGRAM_ID,
): TransactionInstruction {
  if (!programId) throw new Error("FORGE X Fair Launch program ID is not configured");
  if (tokenBaseUnits <= 0n) throw new Error("Sell amount must be positive");
  const state = fairLaunchStatePda(mint, programId);
  const vault = fairLaunchVaultAta(mint, programId);
  const sellerAta = getAssociatedTokenAddressSync(mint, seller);
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: state, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: seller, isSigner: true, isWritable: true },
      { pubkey: sellerAta, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: feeReceiver, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([Buffer.from([2]), u64(tokenBaseUnits)]),
  });
}

export function buildGraduateFairLaunch(
  mint: PublicKey,
  programId = FORGE_X_FAIR_LAUNCH_PROGRAM_ID,
): TransactionInstruction {
  if (!programId) throw new Error("FORGE X Fair Launch program ID is not configured");
  const state = fairLaunchStatePda(mint, programId);
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: state, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([3]),
  });
}
