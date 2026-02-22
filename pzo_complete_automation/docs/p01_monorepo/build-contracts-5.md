# Build Contracts (Version 5) in a Monorepo with Source-of-Truth Trees

This document outlines the process for building contracts within a monorepo setup, utilizing source-of-truth trees.

## Prerequisites

1. Node.js: Ensure you have Node.js installed on your system. (version 14 or later)
2. Yarn: Install Yarn as package manager for your project.
3. Monorepo structure: Organize your project into a monorepo with the following structure:

```
monorepo-root/
|-- contracts/
|   |-- contract1/
|   |   |-- src/
|   |   |   |-- Contract1.sol
|   |   |   |-- ...
|   |-- contract2/
|       |-- src/
|       |   |-- Contract2.sol
|       |   |-- ...
|-- scripts/
|   |-- build-contracts.sh
|   |-- ...
```

## Configuring the Project

1. Install OpenZeppelin: In your monorepo root, install OpenZepplin as a dev dependency.

```bash
yarn add -D @openzeppelin/contracts
```

2. Create a `hardhat.config.js` file in the monorepo root to configure Hardhat.

```javascript
require('@nomiclabs/hardhat-waffle');
require('@openzeppelin/hardhat-upgrades');

module.exports = {
networks: {
hardhat: {
forking: {
url: <YOUR_INFURA_PROJECT_URL>,
blockNumber: <STARTING_BLOCK_NUMBER>
}
},
// Configure other networks here if necessary
},
solidity: {
version: '0.8.4',
settings: {
optimizer: {
enabled: true,
runs: 200
}
}
},
paths: {
artifacts: './artifacts',
cache: './cache',
sources: './contracts/src'
},
namedAccounts: {
deployer: {
default: 0
}
}
};
```

Replace `<YOUR_INFURA_PROJECT_URL>` and `<STARTING_BLOCK_NUMBER>` with your Infura project URL and desired starting block number.

3. Create a `scripts/build-contracts.sh` file for automating the build process.

```bash
#!/usr/bin/env bash

yarn hardhat compile --all-contracts
yarn hardhat clean
yarn hardhat run scripts/deploy.js --network hardhat
```

## Building Contracts

1. Run the build script in your monorepo root to generate the artifacts.

```bash
./scripts/build-contracts.sh
```

This command will compile all contracts, clean the previous artifacts, and deploy them on the hardhat network specified in the `hardhat.config.js`.

By following this setup, you can easily manage and build multiple contracts within your monorepo using source-of-truth trees.
