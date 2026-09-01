use solana_program::{
    account_info::{next_account_info, AccountInfo},
    clock::Clock,
    entrypoint,
    entrypoint::ProgramResult,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    program_pack::Pack,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    system_program,
    sysvar::Sysvar,
};
use spl_token::{instruction as token_instruction, state::{Account as TokenAccount, Mint}};

entrypoint!(process_instruction);

const STATE_VERSION: u8 = 2;
const STATUS_WAITING_FOR_DEV_BUY: u8 = 0;
const STATUS_LIVE: u8 = 1;
const STATUS_GRADUATED: u8 = 2;
const SUPPLY: u64 = 1_000_000_000;
const DECIMALS: u8 = 9;
const TOTAL_SUPPLY_BASE_UNITS: u64 = SUPPLY * 1_000_000_000;
const TRADE_FEE_BPS: u64 = 50;
const BPS_DENOMINATOR: u64 = 10_000;
const STATE_SEED: &[u8] = b"launch";

#[derive(Clone, Copy)]
struct State {
    developer: Pubkey,
    status: u8,
    developer_bought_lamports: u64,
    real_sol_raised: u64,
    virtual_sol_reserve: u64,
    virtual_token_reserve: u64,
    graduation_sol: u64,
    created_at: i64,
}

impl State {
    const LEN: usize = 82;
    fn pack(&self, data: &mut [u8]) -> Result<(), ProgramError> {
        if data.len() < Self::LEN { return Err(ProgramError::AccountDataTooSmall); }
        data[0] = STATE_VERSION;
        data[1..33].copy_from_slice(self.developer.as_ref());
        data[33] = self.status;
        data[34..42].copy_from_slice(&self.developer_bought_lamports.to_le_bytes());
        data[42..50].copy_from_slice(&self.real_sol_raised.to_le_bytes());
        data[50..58].copy_from_slice(&self.virtual_sol_reserve.to_le_bytes());
        data[58..66].copy_from_slice(&self.virtual_token_reserve.to_le_bytes());
        data[66..74].copy_from_slice(&self.graduation_sol.to_le_bytes());
        data[74..82].copy_from_slice(&self.created_at.to_le_bytes());
        Ok(())
    }
    fn unpack(data: &[u8]) -> Result<Self, ProgramError> {
        if data.len() < Self::LEN || data[0] != STATE_VERSION { return Err(ProgramError::InvalidAccountData); }
        Ok(Self {
            developer: Pubkey::new_from_array(data[1..33].try_into().map_err(|_| ProgramError::InvalidAccountData)?),
            status: data[33],
            developer_bought_lamports: u64::from_le_bytes(data[34..42].try_into().map_err(|_| ProgramError::InvalidAccountData)?),
            real_sol_raised: u64::from_le_bytes(data[42..50].try_into().map_err(|_| ProgramError::InvalidAccountData)?),
            virtual_sol_reserve: u64::from_le_bytes(data[50..58].try_into().map_err(|_| ProgramError::InvalidAccountData)?),
            virtual_token_reserve: u64::from_le_bytes(data[58..66].try_into().map_err(|_| ProgramError::InvalidAccountData)?),
            graduation_sol: u64::from_le_bytes(data[66..74].try_into().map_err(|_| ProgramError::InvalidAccountData)?),
            created_at: i64::from_le_bytes(data[74..82].try_into().map_err(|_| ProgramError::InvalidAccountData)?),
        })
    }
}

pub fn process_instruction(program_id: &Pubkey, accounts: &[AccountInfo], instruction_data: &[u8]) -> ProgramResult {
    if instruction_data.is_empty() { return Err(ProgramError::InvalidInstructionData); }
    let mut it = accounts.iter();
    match instruction_data[0] {
        0 => initialize(program_id, &mut it, instruction_data),
        1 => buy(program_id, &mut it, instruction_data),
        2 => sell(program_id, &mut it, instruction_data),
        3 => graduate(program_id, &mut it),
        _ => Err(ProgramError::InvalidInstructionData),
    }
}

fn initialize<'a, I>(program_id: &Pubkey, it: &mut I, data: &[u8]) -> ProgramResult
where I: Iterator<Item = &'a AccountInfo<'a>> {
    if data.len() != 41 { return Err(ProgramError::InvalidInstructionData); }
    let state_account = next_account_info(it)?;
    let mint_account = next_account_info(it)?;
    let developer = next_account_info(it)?;
    let system = next_account_info(it)?;
    if !state_account.is_writable || !developer.is_signer || !developer.is_writable || !system_program::check_id(system.key) { return Err(ProgramError::InvalidArgument); }
    let (expected_state, bump) = Pubkey::find_program_address(&[STATE_SEED, mint_account.key.as_ref()], program_id);
    if state_account.key != &expected_state { return Err(ProgramError::InvalidSeeds); }
    let mint = Mint::unpack(&mint_account.try_borrow_data()?).map_err(|_| ProgramError::InvalidAccountData)?;
    if mint.decimals != DECIMALS || mint.supply != TOTAL_SUPPLY_BASE_UNITS || mint.mint_authority.is_some() || mint.freeze_authority.is_some() { return Err(ProgramError::InvalidArgument); }
    let developer_key = Pubkey::new_from_array(data[1..33].try_into().map_err(|_| ProgramError::InvalidInstructionData)?);
    if developer.key != &developer_key { return Err(ProgramError::InvalidArgument); }
    let graduation_sol = u64::from_le_bytes(data[33..41].try_into().map_err(|_| ProgramError::InvalidInstructionData)?);
    if graduation_sol == 0 { return Err(ProgramError::InvalidArgument); }
    if state_account.owner == &system_program::id() {
        let rent = Rent::get()?.minimum_balance(State::LEN);
        invoke_signed(&system_instruction::create_account(developer.key, state_account.key, rent, State::LEN as u64, program_id), &[developer.clone(), state_account.clone(), system.clone()], &[&[STATE_SEED, mint_account.key.as_ref(), &[bump]]])?;
    }
    if state_account.owner != program_id || state_account.data_len() < State::LEN { return Err(ProgramError::InvalidAccountData); }
    if state_account.try_borrow_data()?[0] != 0 { return Err(ProgramError::AccountAlreadyInitialized); }
    let state = State { developer: *developer.key, status: STATUS_WAITING_FOR_DEV_BUY, developer_bought_lamports: 0, real_sol_raised: 0, virtual_sol_reserve: 1_000_000_000, virtual_token_reserve: TOTAL_SUPPLY_BASE_UNITS, graduation_sol, created_at: Clock::get()?.unix_timestamp };
    state.pack(&mut state_account.try_borrow_mut_data()?)?;
    Ok(())
}

fn parse_amount(data: &[u8]) -> Result<u64, ProgramError> {
    if data.len() != 9 { return Err(ProgramError::InvalidInstructionData); }
    let amount = u64::from_le_bytes(data[1..9].try_into().map_err(|_| ProgramError::InvalidInstructionData)?);
    if amount == 0 { return Err(ProgramError::InvalidArgument); }
    Ok(amount)
}
fn fee(amount: u64) -> Result<(u64, u64), ProgramError> {
    let f = amount.checked_mul(TRADE_FEE_BPS).ok_or(ProgramError::ArithmeticOverflow)? / BPS_DENOMINATOR;
    Ok((f, amount.checked_sub(f).ok_or(ProgramError::ArithmeticOverflow)?))
}
fn buy_quote(net: u64, vs: u64, vt: u64) -> Result<u64, ProgramError> {
    let k = (vs as u128).checked_mul(vt as u128).ok_or(ProgramError::ArithmeticOverflow)?;
    let next_vs = (vs as u128).checked_add(net as u128).ok_or(ProgramError::ArithmeticOverflow)?;
    let next_vt = k / next_vs;
    u64::try_from((vt as u128).checked_sub(next_vt).ok_or(ProgramError::ArithmeticOverflow)?).map_err(|_| ProgramError::ArithmeticOverflow)
}
fn sell_quote(token_in: u64, vs: u64, vt: u64) -> Result<u64, ProgramError> {
    if token_in == 0 || token_in >= vt { return Err(ProgramError::InvalidArgument); }
    let numerator = (token_in as u128).checked_mul(vs as u128).ok_or(ProgramError::ArithmeticOverflow)?;
    let denominator = (vt as u128).checked_add(token_in as u128).ok_or(ProgramError::ArithmeticOverflow)?;
    u64::try_from(numerator / denominator).map_err(|_| ProgramError::ArithmeticOverflow)
}
fn validate_token_accounts(mint: &AccountInfo, vault: &AccountInfo, user: &AccountInfo, user_token: &AccountInfo, program_id: &Pubkey) -> Result<(TokenAccount, TokenAccount), ProgramError> {
    if vault.owner != &spl_token::id() || user_token.owner != &spl_token::id() { return Err(ProgramError::IncorrectProgramId); }
    let v = TokenAccount::unpack(&vault.try_borrow_data()?).map_err(|_| ProgramError::InvalidAccountData)?;
    let u = TokenAccount::unpack(&user_token.try_borrow_data()?).map_err(|_| ProgramError::InvalidAccountData)?;
    let (expected_state, _) = Pubkey::find_program_address(&[STATE_SEED, mint.key.as_ref()], program_id);
    if v.mint != *mint.key || u.mint != *mint.key || v.owner != expected_state || u.owner != *user.key { return Err(ProgramError::InvalidArgument); }
    Ok((v, u))
}

fn buy<'a, I>(program_id: &Pubkey, it: &mut I, data: &[u8]) -> ProgramResult
where I: Iterator<Item = &'a AccountInfo<'a>> {
    let state_account = next_account_info(it)?; let mint = next_account_info(it)?; let buyer = next_account_info(it)?; let buyer_token = next_account_info(it)?; let token_vault = next_account_info(it)?; let fee_receiver = next_account_info(it)?; let system = next_account_info(it)?; let token_program = next_account_info(it)?;
    if !buyer.is_signer || !buyer.is_writable || !state_account.is_writable || !token_vault.is_writable || !buyer_token.is_writable || !fee_receiver.is_writable || !system_program::check_id(system.key) || token_program.key != &spl_token::id() { return Err(ProgramError::InvalidArgument); }
    let (expected_state, bump) = Pubkey::find_program_address(&[STATE_SEED, mint.key.as_ref()], program_id);
    if state_account.key != &expected_state || state_account.owner != program_id { return Err(ProgramError::InvalidSeeds); }
    let (vault, _) = validate_token_accounts(mint, token_vault, buyer, buyer_token, program_id)?;
    let mut state = State::unpack(&state_account.try_borrow_data()?)?;
    if state.status == STATUS_GRADUATED || (state.status == STATUS_WAITING_FOR_DEV_BUY && buyer.key != &state.developer) { return Err(ProgramError::InvalidArgument); }
    let gross = parse_amount(data)?; let (trade_fee, net) = fee(gross)?; let tokens_out = buy_quote(net, state.virtual_sol_reserve, state.virtual_token_reserve)?;
    if tokens_out > vault.amount { return Err(ProgramError::InsufficientFunds); }
    invoke(&system_instruction::transfer(buyer.key, state_account.key, net), &[buyer.clone(), state_account.clone(), system.clone()])?;
    if trade_fee > 0 { invoke(&system_instruction::transfer(buyer.key, fee_receiver.key, trade_fee), &[buyer.clone(), fee_receiver.clone(), system.clone()])?; }
    let token_ix = token_instruction::transfer_checked(&spl_token::id(), token_vault.key, mint.key, buyer_token.key, state_account.key, &[], tokens_out, DECIMALS).map_err(|_| ProgramError::InvalidInstructionData)?;
    invoke_signed(&token_ix, &[token_vault.clone(), mint.clone(), buyer_token.clone(), state_account.clone()], &[&[STATE_SEED, mint.key.as_ref(), &[bump]]])?;
    state.real_sol_raised = state.real_sol_raised.checked_add(net).ok_or(ProgramError::ArithmeticOverflow)?;
    state.virtual_sol_reserve = state.virtual_sol_reserve.checked_add(net).ok_or(ProgramError::ArithmeticOverflow)?;
    state.virtual_token_reserve = state.virtual_token_reserve.checked_sub(tokens_out).ok_or(ProgramError::ArithmeticOverflow)?;
    if state.status == STATUS_WAITING_FOR_DEV_BUY { state.developer_bought_lamports = state.developer_bought_lamports.checked_add(gross).ok_or(ProgramError::ArithmeticOverflow)?; state.status = STATUS_LIVE; }
    if state.real_sol_raised >= state.graduation_sol { state.status = STATUS_GRADUATED; }
    state.pack(&mut state_account.try_borrow_mut_data()?)?;
    Ok(())
}

fn sell<'a, I>(program_id: &Pubkey, it: &mut I, data: &[u8]) -> ProgramResult
where I: Iterator<Item = &'a AccountInfo<'a>> {
    let state_account = next_account_info(it)?; let mint = next_account_info(it)?; let seller = next_account_info(it)?; let seller_token = next_account_info(it)?; let token_vault = next_account_info(it)?; let fee_receiver = next_account_info(it)?; let system = next_account_info(it)?; let token_program = next_account_info(it)?;
    if !seller.is_signer || !seller.is_writable || !state_account.is_writable || !seller_token.is_writable || !token_vault.is_writable || !fee_receiver.is_writable || !system_program::check_id(system.key) || token_program.key != &spl_token::id() { return Err(ProgramError::InvalidArgument); }
    let (expected_state, bump) = Pubkey::find_program_address(&[STATE_SEED, mint.key.as_ref()], program_id);
    if state_account.key != &expected_state || state_account.owner != program_id { return Err(ProgramError::InvalidSeeds); }
    let (_, seller_account) = validate_token_accounts(mint, token_vault, seller, seller_token, program_id)?;
    let mut state = State::unpack(&state_account.try_borrow_data()?)?;
    if state.status != STATUS_LIVE { return Err(ProgramError::InvalidArgument); }
    let token_in = parse_amount(data)?; if token_in > seller_account.amount { return Err(ProgramError::InsufficientFunds); }
    let gross_sol = sell_quote(token_in, state.virtual_sol_reserve, state.virtual_token_reserve)?; let (trade_fee, net_sol) = fee(gross_sol)?;
    let rent_floor = Rent::get()?.minimum_balance(State::LEN); let total_out = net_sol.checked_add(trade_fee).ok_or(ProgramError::ArithmeticOverflow)?;
    if state_account.lamports().checked_sub(total_out).unwrap_or(0) < rent_floor { return Err(ProgramError::InsufficientFunds); }
    let token_ix = token_instruction::transfer_checked(&spl_token::id(), seller_token.key, mint.key, token_vault.key, seller.key, &[], token_in, DECIMALS).map_err(|_| ProgramError::InvalidInstructionData)?;
    invoke(&token_ix, &[seller_token.clone(), mint.clone(), token_vault.clone(), seller.clone()])?;
    if net_sol > 0 { invoke_signed(&system_instruction::transfer(state_account.key, seller.key, net_sol), &[state_account.clone(), seller.clone(), system.clone()], &[&[STATE_SEED, mint.key.as_ref(), &[bump]]])?; }
    if trade_fee > 0 { invoke_signed(&system_instruction::transfer(state_account.key, fee_receiver.key, trade_fee), &[state_account.clone(), fee_receiver.clone(), system.clone()], &[&[STATE_SEED, mint.key.as_ref(), &[bump]]])?; }
    state.real_sol_raised = state.real_sol_raised.checked_sub(net_sol).ok_or(ProgramError::ArithmeticOverflow)?;
    state.virtual_sol_reserve = state.virtual_sol_reserve.checked_sub(gross_sol).ok_or(ProgramError::ArithmeticOverflow)?;
    state.virtual_token_reserve = state.virtual_token_reserve.checked_add(token_in).ok_or(ProgramError::ArithmeticOverflow)?;
    state.pack(&mut state_account.try_borrow_mut_data()?)?;
    Ok(())
}

fn graduate<'a, I>(program_id: &Pubkey, it: &mut I) -> ProgramResult
where I: Iterator<Item = &'a AccountInfo<'a>> {
    let state_account = next_account_info(it)?;
    if !state_account.is_writable || state_account.owner != program_id { return Err(ProgramError::InvalidArgument); }
    let mut state = State::unpack(&state_account.try_borrow_data()?)?;
    if state.status != STATUS_GRADUATED || state.real_sol_raised < state.graduation_sol { return Err(ProgramError::InvalidArgument); }
    state.pack(&mut state_account.try_borrow_mut_data()?)?;
    Ok(())
}
