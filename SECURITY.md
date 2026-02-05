# Security

## Wallet roles

- Hot wallet is used for settlement liquidity and payouts
- Each deal uses a dedicated escrow deposit wallet
- User wallets store payout destinations only

## Escrow safety

- Funds stay in escrow until delivery is verified
- Escrow status controls payout and refund transitions
- Settlement and payout are separated from user actions

## Key handling

- Escrow wallet keys are stored in a separate table
- Keys are encrypted before storage
- Wallet address is validated before use

## Idempotency and locking

- Deposit and payout flows use idempotency keys
- Escrow is locked during payout and refund creation
- Duplicate payouts are blocked by status transitions

## Replay and fraud protections

- Transfers are processed with on chain confirmation
- Posting verification is required before payout
- Refund logic is triggered when payment deadlines expire

## Secrets and config

- Telegram bot token and TON keys are loaded from environment variables
- Never commit real mnemonics or API keys
