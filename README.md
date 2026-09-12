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
- Minimum developer first buy: **0.5 SOL**
- Trading fee: **0.50% (50 bps)**
- Initial virtual SOL reserve: **30 SOL**
- Graduation target: **85 SOL**

The Fair Launch state and token vault are PDAs. Buys and sells use PDA-signed SPL/System Program CPIs. Graduation is terminal for curve trading.

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

## Current verification model

The application verifies important facts against Solana RPC rather than treating UI state as proof:

- Fair Launch mint supply/decimals/authority state
- Fair Launch state status and accounting
- Graduation reserve amounts
- Raydium pool account ownership
- Wallet-signed transaction confirmation
- Transaction errors and expiration

New Raydium devnet pools should be checked through RPC because Raydium's API can lag behind newly-created pools.

## Environment

Copy `.env.example` to `.env.local` and configure the RPC endpoint and deployed Fair Launch program ID.

Required for a live Fair Launch deployment:

- `NEXT_PUBLIC_SOLANA_RPC_URL`
- `SOLANA_RPC_URL`
- `NEXT_PUBLIC_SOLANA_CLUSTER`
- `NEXT_PUBLIC_FORGE_X_PROGRAM_ID`
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
5. Developer first buy, curve buy/sell, graduation, atomic Raydium CPMM creation, and post-migration verification are all exercised on-chain.
6. Metadata upload and immutable metadata verification are exercised with real storage.
7. The on-chain program and migration path receive an independent security review before mainnet.

Until those gates are green, the UI should communicate the environment as development/testing rather than implying production deployment.
