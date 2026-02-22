One Command Substrate Stack 7 (OCSS 7)
=====================================

Overview
--------

One Command Substrate Stack (OCSS) is a tool designed to quickly set up and manage a local development environment for Substrate blockchains. This guide covers the installation and configuration of OCSS 7.

Installation
------------

To install OCSS 7, follow these steps:

1. Install Rust: Follow the instructions provided by the [Rust installation guide](https://www.rust-lang.org/tools/install).
2. Add Substrate and Polkadot to the registry: Run the following command in your terminal:
```
cargo install --git https://github.com/paritytech/substrate --branch polkadot-v0.9.24 --features local,wasmtime
```
3. Install OCSS 7: Run the following command to download and install OCSS 7:
```
curl -sL https://raw.githubusercontent.com/paritytech/ocss/main/scripts/install-ocss.sh | bash
```
4. Add OCSS 7 binaries to the system PATH: Run the following command:
```
source ~/.cargo/env
```

Configuration
-------------

To configure OCSS 7, create a `config.toml` file in your project directory with the following content:

```
[chain]
name = "your-chain-name"
node_name = "your-node-name"
network_id = "your-network-id"

[client]
wasm = "./target/wasm32-unknown-unknown/release/your-contract.wasm"
address = "0xYOUR_CONTRACT_ADDRESS"

[runtime]
runtime_version = 1000

[network]
ssz_client = true
ssz_validator = true
```

Replace the placeholders with your desired values.

Using OCSS 7
------------

To start a local development chain using OCSS 7, run the following command in your project directory:

```
ocss build-chain
```

This command will start building and running your Substrate blockchain locally. You can also use other commands provided by OCSS 7 to manage your development environment, such as `ocss build-runtime`, `ocss test`, and more.

Conclusion
----------

One Command Substrate Stack (OCSS) is an essential tool for developers working on Substrate blockchains. With its easy installation process and powerful command set, OCSS 7 makes it simple to set up a local development environment and manage your projects effectively. For more information about OCSS, visit the [official documentation](https://docs.substrate.io/tutorials/get-started/one-command-stack/).
