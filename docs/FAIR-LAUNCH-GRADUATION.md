# FORGE X Fair Launch graduation

## Flow

1. The Fair Launch program reaches `GRADUATED` when on-chain `real_sol_raised >= graduation_sol`.
2. The developer wallet requests `/api/fair-launch/graduate/prepare` with the mint, developer wallet, SOL amount, and token reserve from the chain state.
3. The server re-reads the Fair Launch PDA and refuses to prepare the transaction unless developer, status, SOL reserve, and token reserve exactly match the request.
4. The server builds the official Raydium SDK V2 CPMM create-pool instructions.
5. The server inserts the FORGE X migration instruction immediately before Raydium's pool setup instructions. The migration is signed by the Fair Launch PDA with `invoke_signed`.
6. The migration transfers the curve token reserve to the developer's token account and the curve's real SOL raised to the developer wallet.
7. Raydium immediately consumes those balances to initialize the CPMM pool in the same atomic transaction.
8. If any later instruction fails, Solana rolls back the PDA migration as part of transaction atomicity.
9. On success, the Fair Launch state becomes `MIGRATED`, preventing a second migration.

## Required environment

- `NEXT_PUBLIC_FORGE_X_PROGRAM_ID` — deployed FORGE X Fair Launch program ID.
- `NEXT_PUBLIC_SOLANA_RPC_URL` — RPC endpoint for the selected cluster.
- `NEXT_PUBLIC_SOLANA_CLUSTER` — `devnet` or `mainnet`.

## Important operational rule

The developer's Fair Launch token account must already exist. The normal developer first buy creates it. The graduation transaction does not silently create a replacement account because the Raydium create-pool flow needs the developer token account while constructing the pool transaction.

## Protocol references

- Solana PDA signing uses `invoke_signed`.
- Raydium SDK V2 `cpmm.createPool` constructs the CPMM initialization transaction and returns its transaction builder/extInfo.
- Raydium's SDK selects the mainnet or devnet CPMM program/config based on cluster.
