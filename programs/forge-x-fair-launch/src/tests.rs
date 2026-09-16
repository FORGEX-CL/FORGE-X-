use super::*;

#[test]
fn developer_minimum_buy_is_exactly_point_zero_five_sol() {
    assert_eq!(MIN_DEV_BUY_LAMPORTS, 50_000_000);
    assert!(MIN_DEV_BUY_LAMPORTS >= 50_000_000);
}

#[test]
fn initial_virtual_sol_reserve_matches_client_config() {
    assert_eq!(INITIAL_VIRTUAL_SOL_RESERVE, 30_000_000_000);
}

#[test]
fn trade_fee_is_fifty_basis_points() {
    let (fee_amount, net) = fee(1_000_000_000).expect("fee calculation");
    assert_eq!(fee_amount, 5_000_000);
    assert_eq!(net, 995_000_000);
}

#[test]
fn fee_never_exceeds_gross_amount() {
    for amount in [1u64, 99, 10_000, 1_000_000_000, u64::MAX / 50] {
        let (fee_amount, net) = fee(amount).expect("fee calculation");
        assert!(fee_amount <= amount);
        assert_eq!(fee_amount + net, amount);
    }
}

#[test]
fn fee_rejects_multiplication_overflow() {
    assert!(fee(u64::MAX).is_err());
}

#[test]
fn buy_quote_reduces_virtual_token_reserve() {
    let vs = INITIAL_VIRTUAL_SOL_RESERVE;
    let vt = TOTAL_SUPPLY_BASE_UNITS;
    let out = buy_quote(50_000_000, vs, vt).expect("buy quote");
    assert!(out > 0);
    assert!(out < vt);
}

#[test]
fn buy_quote_is_monotonic_for_larger_buys() {
    let vs = INITIAL_VIRTUAL_SOL_RESERVE;
    let vt = TOTAL_SUPPLY_BASE_UNITS;
    let small = buy_quote(100_000_000, vs, vt).expect("small quote");
    let large = buy_quote(200_000_000, vs, vt).expect("large quote");
    assert!(large > small);
}

#[test]
fn buy_quote_handles_maximum_u64_inputs() {
    let out = buy_quote(u64::MAX, u64::MAX, u64::MAX).expect("maximum quote fits u128 arithmetic");
    assert!(out > 0);
    assert!(out < u64::MAX);
}

#[test]
fn sell_quote_rejects_zero_input() {
    assert!(sell_quote(0, INITIAL_VIRTUAL_SOL_RESERVE, TOTAL_SUPPLY_BASE_UNITS).is_err());
}

#[test]
fn sell_quote_rejects_full_virtual_reserve() {
    assert!(sell_quote(TOTAL_SUPPLY_BASE_UNITS, INITIAL_VIRTUAL_SOL_RESERVE, TOTAL_SUPPLY_BASE_UNITS).is_err());
}

#[test]
fn sell_quote_is_positive_for_valid_trade() {
    let out = sell_quote(1_000_000_000_000, INITIAL_VIRTUAL_SOL_RESERVE, TOTAL_SUPPLY_BASE_UNITS).expect("sell quote");
    assert!(out > 0);
}

#[test]
fn state_round_trip_preserves_all_fields_including_fee_receiver() {
    let state = State {
        developer: Pubkey::new_unique(),
        status: STATUS_LIVE,
        developer_bought_lamports: 50_000_000,
        real_sol_raised: 12_345_678,
        virtual_sol_reserve: INITIAL_VIRTUAL_SOL_RESERVE + 12_345_678,
        virtual_token_reserve: TOTAL_SUPPLY_BASE_UNITS - 123_456,
        graduation_sol: 85_000_000_000,
        created_at: 1_750_000_000,
        fee_receiver: Pubkey::new_unique(),
    };

    let mut bytes = vec![0u8; State::LEN];
    state.pack(&mut bytes).expect("pack state");
    let decoded = State::unpack(&bytes).expect("unpack state");

    assert_eq!(decoded.developer, state.developer);
    assert_eq!(decoded.status, state.status);
    assert_eq!(decoded.developer_bought_lamports, state.developer_bought_lamports);
    assert_eq!(decoded.real_sol_raised, state.real_sol_raised);
    assert_eq!(decoded.virtual_sol_reserve, state.virtual_sol_reserve);
    assert_eq!(decoded.virtual_token_reserve, state.virtual_token_reserve);
    assert_eq!(decoded.graduation_sol, state.graduation_sol);
    assert_eq!(decoded.created_at, state.created_at);
    assert_eq!(decoded.fee_receiver, state.fee_receiver);
}

#[test]
fn state_layout_and_version_are_explicit() {
    assert_eq!(STATE_VERSION, 3);
    assert_eq!(State::LEN, 114);
}

#[test]
fn state_pack_rejects_short_account_data() {
    let state = State {
        developer: Pubkey::new_unique(),
        status: STATUS_LIVE,
        developer_bought_lamports: 0,
        real_sol_raised: 0,
        virtual_sol_reserve: INITIAL_VIRTUAL_SOL_RESERVE,
        virtual_token_reserve: TOTAL_SUPPLY_BASE_UNITS,
        graduation_sol: 85_000_000_000,
        created_at: 0,
        fee_receiver: Pubkey::new_unique(),
    };
    let mut bytes = vec![0u8; State::LEN - 1];
    assert!(state.pack(&mut bytes).is_err());
}

#[test]
fn state_unpack_rejects_short_account_data() {
    let bytes = vec![0u8; State::LEN - 1];
    assert!(State::unpack(&bytes).is_err());
}

#[test]
fn state_unpack_accepts_only_the_defined_prefix() {
    let state = State {
        developer: Pubkey::new_unique(),
        status: STATUS_LIVE,
        developer_bought_lamports: 50_000_000,
        real_sol_raised: 1_000_000,
        virtual_sol_reserve: INITIAL_VIRTUAL_SOL_RESERVE + 1_000_000,
        virtual_token_reserve: TOTAL_SUPPLY_BASE_UNITS - 1_000_000,
        graduation_sol: 85_000_000_000,
        created_at: 1_750_000_000,
        fee_receiver: Pubkey::new_unique(),
    };
    let mut bytes = vec![0u8; State::LEN + 16];
    state.pack(&mut bytes).expect("pack state prefix");
    assert!(State::unpack(&bytes).is_ok());
}

#[test]
fn migrated_status_is_terminal() {
    assert_ne!(STATUS_MIGRATED, STATUS_LIVE);
    assert_ne!(STATUS_MIGRATED, STATUS_GRADUATED);
}

#[test]
fn state_rejects_wrong_version() {
    let mut bytes = vec![0u8; State::LEN];
    bytes[0] = STATE_VERSION.wrapping_add(1);
    assert!(State::unpack(&bytes).is_err());
}
