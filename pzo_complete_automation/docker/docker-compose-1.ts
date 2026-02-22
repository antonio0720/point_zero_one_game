substrate:
image: substrate/polkadot-v0.9.28
container_name: substrate
restart: always
ports:
- "9944:9944"
- "9933:9933"
- "9945:9945"
environment:
RUST_LOG: substrate=info,paritytech=warn,subxt=trace,substrate-node-template=debug
WASM_BINARY_LOCATION: /opt/local/bin/westend
CHAIN_ genesis_config: |
{
"genesisHash": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
"specVersion": 2501,
"timestamp": 1638479360,
"author": {
"name": "Local Substrate",
"id": "AAA"
},
"genesisState": {
"balances": {
"accounts": [
{
"id": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoW",
"balance": "100000000000000000000"
}
]
},
"extras": [],
"system": {
"accountId": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoW",
"code": "0x5DB41D5B9A00"
}
},
"config": {
"disableUnsafe": false,
"disableFinalizationProof": false,
"minimum GasPrice": 0
}
}
volumes:
- polkadotjs-kusama-cli:/opt/local
- ./keyring:/.local/keyring
command: --base-path /opt/local/chain -- chain spec --final --genesis <(echo "${CHAIN_ genesis_config}") validate-genesis --bootnodes "enode://${BOOTNODE}@${IP}:30333" --write-genesis

polkadotjs-kusama-cli:
image: paritytech/polkadotjs-kusama:v0.47.28
container_name: polkadotjs-kusama-cli
restart: always
volumes:
- ./keyring:/.config/polkadot-js
command: >
sh -c 'set -e; \
key3 restore --name LocalSubstrateKeyring --password local \
/opt/local/chain/keyring/local.json; \
echo "Keyring created or restored."'
```
