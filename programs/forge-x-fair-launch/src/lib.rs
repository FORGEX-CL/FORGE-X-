use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
};

entrypoint!(process_instruction);

const STATE_VERSION: u8 = 1;
const STATUS_WAITING_FOR_DEV_BUY: u8 = 0;
const STATUS_LIVE: u8 = 1;
const STATUS_GRADUATED: u8 = 2;
const SUPPLY: u64 = 1_000_000_000;
const DECIMALS: u8 = 9;
const TRADE_FEE_BPS: u64 = 50;
const BPS_DENOMINATOR: u64 = 10_000;

#[derive(Clone, Copy)]
struct State {
    developer: Pubkey,
    status: u8,
    developer_bought_lamports: u64,
    real_sol_raised: u64,
    virtual_sol_reserve: u64,
    virtual_token_reserve: u64,
    graduation_sol: u64,
}

impl State {
    const LEN: usize = 1 + 32 + 1 + 8 + 8 + 8 + 8 + 8;

    fn pack(&self, data: &mut [u8]) -> Result<(), ProgramError> {
        if data.len() < Self::LEN {
            return Err(ProgramError::AccountDataTooSmall);
        }
        data[0] = STATE_VERSION;
        data[1..33].copy_from_slice(self.developer.as_ref());
        data[33] = self.status;
        data[34..42].copy_from_slice(&self.developer_bought_lamports.to_le_bytes());
        data[42..50].copy_from_slice(&self.real_sol_raised.to_le_bytes());
        data[50..58].copy_from_slice(&self.virtual_sol_reserve.to_le_bytes());
        data[58..66].copy_from_slice(&self.virtual_token_reserve.to_le_bytes());
        data[66..74].copy_from_slice(&self.graduation_sol.to_le_bytes());
        Ok(())
    }

    fn unpack(data: &[u8]) -> Result<Self, ProgramError> {
        if data.len() < Self::LEN || data[0] != STATE_VERSION {
            return Err(ProgramError::InvalidAccountData);
        }
        let developer = Pubkey::new_from_array(data[1..33].try_into().map_err(|_| ProgramError::InvalidAccountData)?);
        Ok(Self {
            developer,
            status: data[33],
            developer_bought_lamports: u64::from_le_bytes(data[34..42].try_into().map_err(|_| ProgramError::InvalidAccountData)?),
            real_sol_raised: u64::from_le_bytes(data[42..50].try_into().map_err(|_| ProgramError::InvalidAccountData)?),
            virtual_sol_reserve: u64::from_le_bytes(data[50..58].try_into().map_err(|_| ProgramError::InvalidAccountData)?),
            virtual_token_reserve: u64::from_le_bytes(data[58..66].try_into().map_err(|_| ProgramError::InvalidAccountData)?),
            graduation_sol: u64::from_le_bytes(data[66..74].try_into().map_err(|_| ProgramError::InvalidAccountData)?),
        })
    }
}

pub fn process_instruction(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let mut accounts_iter = accounts.iter();
    let state_account = next_account_info(&mut accounts_iter)?;

    if !state_account.is_writable {
        return Err(ProgramError::InvalidAccountData);
    }

    if instruction_data.is_empty() {
        return Err(ProgramError::InvalidInstructionData);
    }

    match instruction_data[0] {
        // Initialize: [0][developer 32][graduation_sol u64]
        0 => initialize(state_account, instruction_data),
        // Developer buy: [1][gross_lamports u64]
        1 => developer_buy(state_account, accounts_iter, instruction_data),
        // Public buy: [2][gross_lamports u64]
        2 => public_buy(state_account, accounts_iter, instruction_data),
        // Graduate: [3]
        3 => graduate(state_account),
        _ => Err(ProgramError::InvalidInstructionData),
    }
}

fn initialize(state_account: &AccountInfo, data: &[u8]) -> ProgramResult {
    if data.len() != 1 + 32 + 8 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let developer = Pubkey::new_from_array(data[1..33].try_into().map_err(|_| ProgramError::InvalidInstructionData)?);
    let graduation_sol = u64::from_le_bytes(data[33..41].try_into().map_err(|_| ProgramError::InvalidInstructionData)?);
    if graduation_sol == 0 {
        return Err(ProgramError::InvalidArgument);
    }

    let state = State {
        developer,
        status: STATUS_WAITING_FOR_DEV_BUY,
        developer_bought_lamports: 0,
        real_sol_raised: 0,
        // Initial virtual reserves are protocol constants for the first implementation.
        virtual_sol_reserve: 1_000_000_000,
        virtual_token_reserve: SUPPLY * 10u64.pow(DECIMALS as u32),
        graduation_sol,
    };
    state.pack(&mut state_account.try_borrow_mut_data()?)?;
    msg!("FORGE X Fair Launch initialized");
    Ok(())
}

fn read_lamports(data: &[u8]) -> Result<u64, ProgramError> {
    if data.len() != 1 + 8 {
        return Err(ProgramError::InvalidInstructionData);
    }
    Ok(u64::from_le_bytes(data[1..9].try_into().map_err(|_| ProgramError::InvalidInstructionData)?))
}

fn apply_fee(amount: u64) -> Result<(u64, u64), ProgramError> {
    let fee = amount.checked_mul(TRADE_FEE_BPS).ok_or(ProgramError::ArithmeticOverflow)? / BPS_DENOMINATOR;
    let net = amount.checked_sub(fee).ok_or(ProgramError::ArithmeticOverflow)?;
    Ok((fee, net))
}

fn buy_quote(net_sol: u64, virtual_sol: u64, virtual_tokens: u64) -> Result<u64, ProgramError> {
    let k = (virtual_sol as u128)
        .checked_mul(virtual_tokens as u128)
        .ok_or(ProgramError::ArithmeticOverflow)?;
    let next_sol = (virtual_sol as u128)
        .checked_add(net_sol as u128)
        .ok_or(ProgramError::ArithmeticOverflow)?;
    let next_tokens = k / next_sol;
    let out = (virtual_tokens as u128)
        .checked_sub(next_tokens)
        .ok_or(ProgramError::ArithmeticOverflow)?;
    u64::try_from(out).map_err(|_| ProgramError::ArithmeticOverflow)
}

fn developer_buy<'a, I>(state_account: &AccountInfo<'a>, mut accounts: I, data: &[u8]) -> ProgramResult
where
    I: Iterator<Item = &'a AccountInfo<'a>>,
{
    let buyer = next_account_info(&mut accounts)?;
    if !buyer.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    let mut state = State::unpack(&state_account.try_borrow_data()?)?;
    if state.status != STATUS_WAITING_FOR_DEV_BUY || buyer.key != &state.developer {
        return Err(ProgramError::InvalidArgument);
    }
    let gross = read_lamports(data)?;
    if gross == 0 {
        return Err(ProgramError::InvalidArgument);
    }
    let (_fee, net) = apply_fee(gross)?;
    let _tokens_out = buy_quote(net, state.virtual_sol_reserve, state.virtual_token_reserve)?;
    state.developer_bought_lamports = state.developer_bought_lamports.checked_add(gross).ok_or(ProgramError::ArithmeticOverflow)?;
    state.real_sol_raised = state.real_sol_raised.checked_add(net).ok_or(ProgramError::ArithmeticOverflow)?;
    state.virtual_sol_reserve = state.virtual_sol_reserve.checked_add(net).ok_or(ProgramError::ArithmeticOverflow)?;
    state.status = STATUS_LIVE;
    state.pack(&mut state_account.try_borrow_mut_data()?)?;
    msg!("FORGE X developer first buy accepted");
    Ok(())
}

fn public_buy<'a, I>(state_account: &AccountInfo<'a>, mut accounts: I, data: &[u8]) -> ProgramResult
where
    I: Iterator<Item = &'a AccountInfo<'a>>,
{
    let buyer = next_account_info(&mut accounts)?;
    if !buyer.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    let mut state = State::unpack(&state_account.try_borrow_data()?)?;
    if state.status != STATUS_LIVE {
        return Err(ProgramError::InvalidArgument);
    }
    let gross = read_lamports(data)?;
    if gross == 0 {
        return Err(ProgramError::InvalidArgument);
    }
    let (_fee, net) = apply_fee(gross)?;
    let _tokens_out = buy_quote(net, state.virtual_sol_reserve, state.virtual_token_reserve)?;
    state.real_sol_raised = state.real_sol_raised.checked_add(net).ok_or(ProgramError::ArithmeticOverflow)?;
    state.virtual_sol_reserve = state.virtual_sol_reserve.checked_add(net).ok_or(ProgramError::ArithmeticOverflow)?;
    if state.real_sol_raised >= state.graduation_sol {
        state.status = STATUS_GRADUATED;
    }
    state.pack(&mut state_account.try_borrow_mut_data()?)?;
    msg!("FORGE X public buy accepted");
    Ok(())
}

fn graduate(state_account: &AccountInfo) -> ProgramResult {
    let mut state = State::unpack(&state_account.try_borrow_data()?)?;
    if state.status != STATUS_GRADUATED {
        return Err(ProgramError::InvalidArgument);
    }
    msg!("FORGE X Fair Launch ready for liquidity migration");
    state.pack(&mut state_account.try_borrow_mut_data()?)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fee_is_half_percent() {
        let (fee, net) = apply_fee(100_000).unwrap();
        assert_eq!(fee, 500);
        assert_eq!(net, 99_500);
    }

    #[test]
    fn curve_quote_is_positive() {
        let out = buy_quote(100_000, 1_000_000_000, SUPPLY * 10u64.pow(DECIMALS as u32)).unwrap();
        assert!(out > 0);
    }
}
