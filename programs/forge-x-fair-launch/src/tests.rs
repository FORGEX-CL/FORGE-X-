use super::*;

#[test]
fn developer_minimum_buy_is_exactly_half_sol() {
    assert_eq!(MIN_DEV_BUY_LAMPORTS, 500_000_000);
    assert!(MIN_DEV_BUY_LAMPORTS >= 500_000_000);
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
fn buy_quote_reduces_virtual_token_reserve() {
    let vs = 1_000_000_000u64;
    let vt = TOTAL_SUPPLY_BASE_UNITS;
    let out = buy_quote(500_000_000, vs, vt).expect("buy quote");
    assert!(out > 0);
    assert!(out < vt);
}

#[test]
fn buy_quote_is_monotonic_for_larger_buys() {
    let vs = 1_000_000_000u64;
    let vt = TOTAL_SUPPLY_BASE_UNITS;
    let small = buy_quote(100_000_000, vs, vt).expect("small quote");
    let large = buy_quote(200_000_000, vs, vt).expect("large quote");
    assert!(large > small);
}

#[test]
fn sell_quote_rejects_full_virtual_reserve() {
    assert!(sell_quote(TOTAL_SUPPLY_BASE_UNITS, 1_000_000_000, TOTAL_SUPPLY_BASE_UNITS).is_err());
}

#[test]
fn sell_quote_is_positive_for_valid_trade() {
    let out = sell_quote(1_000_000, 2_000_000_000, TOTAL_SUPPLY_BASE_UNITS).expect("sell quote");
    assert!(out > 0);
}

#[test]
fn state_round_trip_preserves_all_fields() {
    let state = State {
        developer: Pubkey::new_unique(),
        status: STATUS_LIVE,
        developer_bought_lamports: 500_000_000,
        real_sol_raised: 12_345_678,
        virtual_sol_reserve: 1_012_345_678,
        virtual_token_reserve: TOTAL_SUPPLY_BASE_UNITS - 123_456,
        graduation_sol: 85_000_000_000,
        created_at: 1_750_000_000,
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
}

#[test]
fn state_rejects_wrong_version() {
    let mut bytes = vec![0u8; State::LEN];
    bytes[0] = STATE_VERSION.wrapping_add(1);
    assert!(State::unpack(&bytes).is_err());
}
