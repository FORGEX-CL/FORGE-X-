import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";

const SYSTEM_CREATE_ACCOUNT_WITH_SEED = 3;
const TOKEN_INITIALIZE_ACCOUNT = 1;
const TOKEN_TRANSFER = 3;
const TOKEN_CLOSE_ACCOUNT = 9;
const ASSOCIATED_CREATE_IDEMPOTENT = 1;
const TOKEN_ACCOUNT_SIZE = 165;
const SYSTEM_PROGRAM = new PublicKey("11111111111111111111111111111111");
const ASSOCIATED_TOKEN_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZsiqW5xWH25efTNsLJA8knL");
const RENT_SYSVAR = new PublicKey("SysvarRent111111111111111111111111111111111");

function u32(data: Uint8Array, offset: number): number {
  if (offset + 4 > data.length) throw new Error("Instruction data is truncated");
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(offset, true);
}

function u64(data: Uint8Array, offset: number): bigint {
  if (offset + 8 > data.length) throw new Error("Instruction data is truncated");
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getBigUint64(offset, true);
}

function key(accountKeys: PublicKey[], indexes: number[], position: number, label: string): PublicKey {
  const index = indexes[position];
  const value = accountKeys[index];
  if (!value) throw new Error("Supporting instruction " + label + " references an unresolved account");
  return value;
}

function equalAny(value: PublicKey, candidates: PublicKey[]): boolean {
  return candidates.some((candidate) => value.equals(candidate));
}

function verifyAtaInstruction(
  instruction: VersionedTransaction["message"]["compiledInstructions"][number],
  accountKeys: PublicKey[],
  trader: PublicKey,
  inputMint: PublicKey,
  outputMint: PublicKey,
  inputTokenProgram: PublicKey,
  outputTokenProgram: PublicKey,
): void {
  if (instruction.data.length !== 1 || instruction.data[0] !== ASSOCIATED_CREATE_IDEMPOTENT) {
    throw new Error("Associated Token instruction is not CreateIdempotent");
  }
  if (instruction.accountKeyIndexes.length !== 6) {
    throw new Error("Associated Token instruction has unexpected account count");
  }

  const payer = key(accountKeys, instruction.accountKeyIndexes, 0, "payer");
  const ata = key(accountKeys, instruction.accountKeyIndexes, 1, "ATA");
  const owner = key(accountKeys, instruction.accountKeyIndexes, 2, "owner");
  const mint = key(accountKeys, instruction.accountKeyIndexes, 3, "mint");
  const system = key(accountKeys, instruction.accountKeyIndexes, 4, "system program");
  const tokenProgram = key(accountKeys, instruction.accountKeyIndexes, 5, "token program");

  if (!payer.equals(trader) || !owner.equals(trader)) {
    throw new Error("Associated Token instruction must be paid for and owned by the connected trader");
  }
  if (!equalAny(mint, [inputMint, outputMint])) {
    throw new Error("Associated Token instruction uses an unexpected mint");
  }

  const expectedProgram = mint.equals(inputMint) ? inputTokenProgram : outputTokenProgram;
  if (!tokenProgram.equals(expectedProgram)) {
    throw new Error("Associated Token instruction uses an unexpected token program");
  }
  if (!system.equals(SYSTEM_PROGRAM)) {
    throw new Error("Associated Token instruction uses an unexpected system program");
  }

  const [expectedAta] = PublicKey.findProgramAddressSync(
    [trader.toBuffer(), tokenProgram.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM,
  );
  if (!ata.equals(expectedAta)) {
    throw new Error("Associated Token instruction does not derive the canonical trader ATA");
  }
}

function readCreateAccountWithSeed(
  instruction: VersionedTransaction["message"]["compiledInstructions"][number],
  accountKeys: PublicKey[],
  trader: PublicKey,
  expectedTokenProgram: PublicKey,
  expectedLamports: bigint,
): PublicKey {
  const data = instruction.data;
  if (data.length < 4 + 32 + 4 + 8 + 8 + 32 || u32(data, 0) !== SYSTEM_CREATE_ACCOUNT_WITH_SEED) {
    throw new Error("System instruction must be CreateAccountWithSeed");
  }

  const base = new PublicKey(data.slice(4, 36));
  const seedLength = u32(data, 36);
  const seedStart = 40;
  const seedEnd = seedStart + seedLength;
  if (seedEnd + 8 + 8 + 32 !== data.length) {
    throw new Error("CreateAccountWithSeed data has an unexpected layout");
  }

  const seed = new TextDecoder().decode(data.slice(seedStart, seedEnd));
  const lamports = u64(data, seedEnd);
  const space = u64(data, seedEnd + 8);
  const owner = new PublicKey(data.slice(seedEnd + 16, seedEnd + 48));

  if (!base.equals(trader) || !owner.equals(expectedTokenProgram)) {
    throw new Error("CreateAccountWithSeed must derive from the trader and use the verified token program");
  }
  if (space !== BigInt(TOKEN_ACCOUNT_SIZE) || lamports !== expectedLamports) {
    throw new Error("CreateAccountWithSeed funding or account size is not the verified WSOL setup");
  }

  if (instruction.accountKeyIndexes.length !== 2 && instruction.accountKeyIndexes.length !== 3) {
    throw new Error("CreateAccountWithSeed has unexpected account count");
  }
  const payer = key(accountKeys, instruction.accountKeyIndexes, 0, "create payer");
  const created = key(accountKeys, instruction.accountKeyIndexes, 1, "created account");
  if (!payer.equals(trader) || !created.equals(PublicKey.createWithSeed(trader, seed, expectedTokenProgram))) {
    throw new Error("CreateAccountWithSeed does not derive the expected trader-owned token account");
  }
  if (instruction.accountKeyIndexes.length === 3 && !key(accountKeys, instruction.accountKeyIndexes, 2, "create base").equals(trader)) {
    throw new Error("CreateAccountWithSeed base signer is not the trader");
  }
  return created;
}

function verifyInitializeAccount(
  instruction: VersionedTransaction["message"]["compiledInstructions"][number],
  accountKeys: PublicKey[],
  trader: PublicKey,
  allowedTokenPrograms: PublicKey[],
  allowedMints: PublicKey[],
): void {
  if (instruction.data.length !== 1 || instruction.data[0] !== TOKEN_INITIALIZE_ACCOUNT) {
    throw new Error("Token initialization instruction is not InitializeAccount");
  }
  if (instruction.accountKeyIndexes.length !== 4) {
    throw new Error("Token initialization has unexpected account count");
  }
  const account = key(accountKeys, instruction.accountKeyIndexes, 0, "initialized account");
  const mint = key(accountKeys, instruction.accountKeyIndexes, 1, "initialized mint");
  const owner = key(accountKeys, instruction.accountKeyIndexes, 2, "initialized owner");
  const rent = key(accountKeys, instruction.accountKeyIndexes, 3, "rent sysvar");
  const program = accountKeys[instruction.programIdIndex];

  if (!program || !equalAny(program, allowedTokenPrograms) || !equalAny(mint, allowedMints) || !owner.equals(trader)) {
    throw new Error("Token initialization uses unexpected ownership, mint, or token program");
  }
  if (!rent.equals(RENT_SYSVAR) || account.equals(mint)) {
    throw new Error("Token initialization has invalid supporting accounts");
  }
}

function verifyCloseAccount(
  instruction: VersionedTransaction["message"]["compiledInstructions"][number],
  accountKeys: PublicKey[],
  trader: PublicKey,
  allowedTokenPrograms: PublicKey[],
): void {
  if (instruction.data.length !== 1 || instruction.data[0] !== TOKEN_CLOSE_ACCOUNT) {
    throw new Error("Token close instruction is not CloseAccount");
  }
  if (instruction.accountKeyIndexes.length !== 3) {
    throw new Error("Token close instruction has unexpected account count");
  }
  const account = key(accountKeys, instruction.accountKeyIndexes, 0, "close account");
  const destination = key(accountKeys, instruction.accountKeyIndexes, 1, "close destination");
  const owner = key(accountKeys, instruction.accountKeyIndexes, 2, "close owner");
  const program = accountKeys[instruction.programIdIndex];

  if (!program || !equalAny(program, allowedTokenPrograms) || !owner.equals(trader) || !destination.equals(trader)) {
    throw new Error("Token close instruction must return funds to the connected trader");
  }
  if (account.equals(trader)) {
    throw new Error("Token close instruction cannot close the trader wallet");
  }
}

export async function auditRaydiumSwapSupportingInstructions(
  connection: Connection,
  transaction: VersionedTransaction,
  accountKeys: PublicKey[],
  trader: PublicKey,
  inputMint: PublicKey,
  outputMint: PublicKey,
  inputTokenProgram: PublicKey,
  outputTokenProgram: PublicKey,
  inputAmount: bigint,
): Promise<void> {
  const allowedMints = [inputMint, outputMint];
  const allowedTokenPrograms = [inputTokenProgram, outputTokenProgram];
  const wsol = new PublicKey(NATIVE_MINT.toBase58());
  const rent = BigInt(await connection.getMinimumBalanceForRentExemption(TOKEN_ACCOUNT_SIZE, "confirmed"));
  const expectedWsolFunding = inputMint.equals(wsol) ? rent + inputAmount : rent;

  const createdAccounts = new Set<string>();
  const expectedTemporaryPrograms = new Set(allowedTokenPrograms.map((program) => program.toBase58()));

  for (const instruction of transaction.message.compiledInstructions) {
    const program = accountKeys[instruction.programIdIndex];
    if (!program) throw new Error("Prepared swap contains an unresolved program account");

    if (program.equals(ASSOCIATED_TOKEN_PROGRAM)) {
      verifyAtaInstruction(instruction, accountKeys, trader, inputMint, outputMint, inputTokenProgram, outputTokenProgram);
      continue;
    }

    if (program.equals(SYSTEM_PROGRAM)) {
      const created = readCreateAccountWithSeed(
        instruction,
        accountKeys,
        trader,
        new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        expectedWsolFunding,
      );
      createdAccounts.add(created.toBase58());
      continue;
    }

    if (expectedTemporaryPrograms.has(program.toBase58())) {
      const data = instruction.data;
      if (data.length !== 1 || data[0] !== TOKEN_INITIALIZE_ACCOUNT) {
        throw new Error("Prepared swap contains an unsupported token-program instruction");
      }
      verifyInitializeAccount(instruction, accountKeys, trader, allowedTokenPrograms, allowedMints);
      const initialized = key(accountKeys, instruction.accountKeyIndexes, 0, "initialized account");
      if (!createdAccounts.has(initialized.toBase58())) {
        throw new Error("Token account initialization is not bound to a transaction-created trader account");
      }
      continue;
    }

    if (program.equals(new PublicKey("ComputeBudget111111111111111111111111111111"))) {
      if (instruction.data.length < 1 || ![1, 2, 3, 4].includes(instruction.data[0])) {
        throw new Error("Compute Budget instruction has an unsupported variant");
      }
      continue;
    }

    throw new Error("Prepared swap contains an unsupported supporting instruction");
  }

  for (const created of createdAccounts) {
    const createdKey = new PublicKey(created);
    const account = await connection.getAccountInfo(createdKey, "confirmed");
    if (!account && !allowedMints.some((mint) => mint.equals(wsol))) {
      throw new Error("Prepared swap created an unexpected token account");
    }
  }

  void inputAmount;
  void expectedTemporaryPrograms;
}
