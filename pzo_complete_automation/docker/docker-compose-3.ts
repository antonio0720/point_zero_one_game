version: "3"
services:
polkadot:
image: substrate/polkadot:v0.9.27-x86_64-unknown-linux-gnu
container_name: polkadot
environment:
RUST_LOG=debug
WASM_BINARY_DIR=./target/wasm32-unknown-unknown/release
CHAIN_ genesis=true
BABE_AUTHORITY_SET_ENCODED='["5GrwVaFf9pJ47TeWQFbvfA8iimAnrKhP3FVfN6WnSoLyGZ68zj5CRR4vqfUxP9""]'
ALICI_KEY_NAME=alice
SAFER_SEAL=false
volumes:
- "./substrate-local/polkadot:/substrate-local/polkadot"
ports:
- "9944:9944"
- "9933:9933"
- "9920:9920"

telegram-bot:
image: telegram/telegram-bot-api:latest
container_name: telegram-bot
environment:
TG_API_ID: <Telegram API ID>
TG_API_HASH: <Telegram API HASH>
CHAT_ID: <Telegram Chat ID>
POLKADOT_WS_URL: "ws://polkadot:9944"
depends_on:
- polkadot
