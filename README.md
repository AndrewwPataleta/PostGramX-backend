<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="200" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://coveralls.io/github/nestjs/nest?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/nestjs/nest/badge.svg?branch=master#9" alt="Coverage" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Installation

```bash
$ npm install
```

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Telegram Bot (Polling MVP)

Set the required environment variables before starting the backend:

```bash
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_BOT_USERNAME=Postgramx_bot
TELEGRAM_MINI_APP_URL=https://t.me/postgramx_bot?startapp=marketplace
TELEGRAM_MINIAPP_SHORT_NAME=PostgramX
TELEGRAM_BOT_MODE=polling
TELEGRAM_WEBHOOK_URL=
TELEGRAM_ALLOWED_UPDATES=message,callback_query
```

Run the backend locally (the bot will start polling automatically):

```bash
pnpm start:dev
```

Test the bot in Telegram:

1. Open the bot chat.
2. Send `/start`.
3. Send `/help`.
4. Tap “Open Mini App”.

> ⚠️ Polling should run in a single instance. For production, prefer webhooks or a dedicated bot worker.

### Mini App deep links

Deal notifications use the `startapp` payload format `deal_<dealId>`. The Mini App should parse
`initData.start_param` and route users to `/deals/:id` accordingly.
Ensure `TELEGRAM_BOT_USERNAME` is set in stage/prod so deep links can open the Mini App directly.

## Test

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Channel linking API

All channel endpoints are prefixed with `/api` in production (for example, `https://postgramx.com/api/channels/preview`).

### Preview channel

```bash
curl -X POST https://postgramx.com/api/channels/preview \\
  -H "Content-Type: application/json" \\
  -d '{"data":{"usernameOrLink":"https://t.me/examplechannel"}}'
```

### Link channel

```bash
curl -X POST https://postgramx.com/api/channels/link \\
  -H "Content-Type: application/json" \\
  -d '{"data":{"username":"examplechannel"}}'
```

### Verify channel

```bash
curl -X POST https://postgramx.com/api/channels/<channelId>/verify
```

## Payments ledger API

### List transactions

```bash
curl -X POST http://localhost:8080/payments/transactions/list \\
  -H "Content-Type: application/json" \\
  -H "X-Telegram-Mock: true" \\
  -d '{ "platformType":"telegram", "authType":"telegram", "token":"<initData>", "data": { "page":1, "limit":20 } }'
```

### Get transaction

```bash
curl -X POST http://localhost:8080/payments/transactions/<ID> \\
  -H "Content-Type: application/json" \\
  -H "X-Telegram-Mock: true" \\
  -d '{ "platformType":"telegram", "authType":"telegram", "token":"<initData>", "data": {} }'
```

## Testing TON Payments (MVP)

For the MVP we support TON testnet or mainnet with small-value testing only.
Recommended wallet: **Tonkeeper** (mobile). Supported wallets include Tonkeeper, Telegram Wallet (if supported), and Tonhub.

### Create a test wallet

1. Install Tonkeeper from the iOS App Store or Google Play.
2. Create a new wallet and **save your seed phrase securely**.
3. Do **not** use real funds for MVP testing.
4. If you are using testnet mode: Tonkeeper → Settings → Network → Testnet.

### Get test TON (testnet)

Use a faucet bot such as: https://t.me/testgiver_ton_bot

1. Open the bot and run `/start`.
2. Paste your wallet address.
3. Receive free test TON for testing.

### Connect wallet to the Mini App

The Mini App opens a TonConnect modal. Users must:

1. Approve the connection.
2. Confirm address sharing.

### Payment flow (MVP)

Current escrow flow:

1. Advertiser creates a deal.
2. Clicks **Pay**.
3. Wallet opens via TonConnect.
4. User sends TON to the generated escrow address.
5. Backend waits for on-chain confirmation.
6. After post verification, funds are released.

### Important warnings

- MVP environment — **do not** send large amounts.
- Payments are not production-hardened yet.
- Refunds or manual recovery may be required.
- Always use testnet or minimal TON.

### Environment configuration

```bash
TON_NETWORK=testnet
TON_HOT_WALLET_ADDRESS=EQBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TON_API_PROVIDER=toncenter
```

Notes:

- The hot wallet is only for aggregation/settlement.
- Deal wallets should be generated per deal (recommended).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://kamilmysliwiec.com)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](LICENSE).
