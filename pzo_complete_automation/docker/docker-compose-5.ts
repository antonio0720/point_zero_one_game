version: '3'
services:
polkadot:
image: substrate/polkadot:latest
container_name: polkadot
ports:
- "9944:9944"
- "9933:9933"
- "9678:9678"
environment:
WS_PORT: 9944
RPC_PORT: 9933
NATIVE_TOKEN_DECIMALS: 12
CHAIN_GENESIS_FILE: "/genesis.json"
volumes:
- ./polkadot:/root/.substrate
- ./genesis.json:/root/.substrate/genesis-config.json

telegram-bot:
image: substrate/telegram-bot:latest
container_name: telegram-bot
environment:
POLKADOT_WS_URL: "ws://polkadot:9944"
TG_BOT_TOKEN: "<YOUR_TELEGRAM_BOT_TOKEN>"
CHAT_ID: "<YOUR_TELEGRAM_CHAT_ID>"
depends_on:
- polkadot
