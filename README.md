# FORGE X

FORGE X is a Solana-first platform for token discovery, Fair Launch, trading, liquidity, portfolio tracking, and on-chain security.

## Product architecture

The primary navigation is intentionally compact:

- Home
- Market
- Launch
- Trade
- Pools
- Portfolio
- Developers
- FORGE AI (global/contextual entry)

Trust, wallet intelligence, analytics, risk signals, notifications, and boosting are contextual capabilities rather than separate top-level products.

## Fair Launch protocol

Fair Launch is implemented as a native Solana program using the legacy SPL Token program.

Protocol invariants:

- Total supply: **1,000,000,000 tokens**
- Decimals: **9**
- Mint authority: **revoked**
- Freeze authority: **revoked**
- Metadata update authority: **revoked and metadata immutable**
- Developer first buy: **required**
- Minimum developer first buy: **0.05 SOL**
- Trading fee: **0.50% (50 bps)**
- Initial virtual SOL reserve: **30 SOL**
- Graduation target: **85 SOL**

The Fair Launch state and token vault are PDAs. Buys and sells use PDA-signed SPL/System Program CPIs. Graduation is terminal for curve trading.

### Launch transaction boundaries

The token-creation transaction is deliberately kept separate from curve initialization. Current legacy/v0 Solana transactions have a 1,232-byte serialized limit, so FORGE X does not attempt to pack token creation, Metaplex metadata, Fair Launch initialization, ATA creation, and vault seeding into one oversized message.

The launch flow is:

1. Create the SPL mint, fixed supply and developer token account.
2. Revoke mint/freeze authorities and make metadata immutable in the same wallet-signed launch transaction.
3. Confirm that transaction on Solana.
4. Prepare and sign a second transaction that initializes the Fair Launch PDA and moves the full supply into its vault.
5. Confirm initialization.
6. Prepare and sign the required **0.05 SOL minimum developer first buy**.
7. Only after that confirmation does public curve trading open.

Every step is real wallet signing plus on-chain confirmation; UI state is never treated as proof.

## Graduation and Raydium CPMM

Graduation is prepared from live chain state. The client verifies the Fair Launch state and vault balance before building the pool transaction.

The migration design is atomic:

1. The developer wallet prepares the official Raydium CPMM create-pool instructions.
2. The same transaction first invokes the FORGE X migration instruction.
3. The Fair Launch PDA signs the migration CPI and moves the graduated token/SOL reserves to the developer's wallet accounts.
4. Raydium CPMM immediately consumes those balances to create the pool.
5. The developer signs the final transaction.
6. If any instruction fails, Solana transaction atomicity rolls the complete transaction back.

This avoids moving the reserves through an untrusted server or custodian.

### Post-migration trading

Migrated pools use a separate Raydium CPMM execution path; Fair Launch curve instructions are never sent to arbitrary external pools.

Before a migrated-pool swap, FORGE X:

- verifies the pool account is owned by the expected Raydium CPMM program for the active cluster;
- verifies the selected token belongs to that pool and reads current pool reserves from Raydium/RPC;
- calculates the expected output and minimum output using the current Raydium CPMM curve calculation;
- prepares the official Raydium CPMM swap transaction for the connected wallet;
- lets the wallet sign the transaction; and
- polls the actual Solana signature status and blockhash validity before reporting success.

Verified pools in the Pools page can open the same execution path from a **Trade** action. Devnet pool discovery uses Raydium RPC because Raydium's API can lag behind newly-created pools; mainnet pool discovery can use the Raydium API plus on-chain verification.

## Current verification model

The application verifies important facts against Solana RPC rather than treating UI state as proof:

- Fair Launch mint supply/decimals/authority state
- Fair Launch state status and accounting
- Graduation reserve amounts
- Fair Launch token-vault ownership and balances
- Raydium pool account ownership
- Raydium pool mint membership
- Wallet-signed transaction confirmation
- Transaction errors and blockhash expiry

## Environment

Copy `.env.example` to `.env.local` and configure the RPC endpoint, deployed Fair Launch program ID, and platform fee receiver.

Required for a live Fair Launch deployment:

- `NEXT_PUBLIC_SOLANA_RPC_URL`
- `SOLANA_RPC_URL`
- `NEXT_PUBLIC_SOLANA_CLUSTER`
- `NEXT_PUBLIC_FORGE_X_PROGRAM_ID`
- `FORGE_X_FEE_RECEIVER`
- `NEXT_PUBLIC_FORGE_X_FEE_RECEIVER` for browser-side trade preparation
- `PINATA_JWT` for server-side metadata uploads

Never commit secrets.

## Development

```bash
npm install
npm run dev
```

Run the native Fair Launch program tests with:

```bash
npm run test:fair-launch
```

Run the web checks with:

```bash
npm run lint
npm run build
```

## Deployment gate

FORGE X must not be presented as mainnet-ready until all of the following are complete:

1. Native program tests are green in CI.
2. Web lint/build are green in CI.
3. The Fair Launch program is deployed to the intended Solana cluster and its program ID is configured.
4. A real Devnet end-to-end launch is completed with a funded test wallet.
5. Developer first buy, curve buy/sell, graduation, atomic Raydium CPMM creation, post-migration Raydium swap, and post-migration verification are all exercised on-chain.
6. Metadata upload and immutable metadata verification are exercised with real storage.
7. The on-chain program and migration path receive an independent security review before mainnet.

Until those gates are green, the UI should communicate the environment as development/testing rather than implying production deployment.
