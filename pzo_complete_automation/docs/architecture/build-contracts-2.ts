1. Install dependencies:

```bash
npm install --save-dev lerna hardhat @nomiclabs/hardhat-waffle ethers ts-mocha @types/ethers @types/mocha chai
```

2. Create a `hardhat.config.ts` file in the root of your monorepo:

```typescript
import 'dotenv/config';
import { HardhatUserConfig } from 'hardhat/config';
import '@nomiclabs/hardhat-waffle';
import 'ts-mocha';
import 'ethers';
import 'chai';

const config: HardhatUserConfig = {
defaultNetwork: 'hardhat',
networks: {
hardhat: {
forking: {
url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
blockNumber: process.env.BLOCK_NUMBER || 13900000,
},
},
},
solidity: {
version: '0.8.4',
settings: {
optimizer: {
enabled: true,
runs: 200,
},
},
},
};

export default config;
```

3. Create a `lerna.json` file in the root of your monorepo:

```json
{
"version": "1.0.0",
"packages": [
"contracts"
],
"scripts": {
"build": "hardhat run --config hardhat.config.ts build",
"test": "jest",
"lint": "prettier --check \"**/*.{sol,ts}\" && eslint \"src/**/*.{sol,ts}\""
}
}
```

4. Create a `contracts/package.json` file:

```json
{
"name": "contracts",
"version": "1.0.0",
"dependencies": {
"ethers": "^5.6.2",
"hardhat": "^2.8.4"
},
"devDependencies": {
"@nomiclabs/hardhat-waffle": "^2.0.13",
"@types/ethers": "^5.6.2",
"@types/mocha": "^9.0.0",
"chai": "^4.3.4",
"solhint": "^0.17.3",
"ts-mocha": "^11.1.0"
},
"scripts": {
"build": "hardhat build",
"test": "hardhat test"
}
}
```

5. In the `contracts` directory, create a folder for each contract and write your Solidity files there.

6. Create a `src` directory in the `contracts` folder and write TypeScript helper files if needed:

```typescript
// src/helpers.ts
import { Contract } from 'ethers';
import * as ethers from 'ethers';

export function getContract(address: string, ABI: any[], provider?: ethers.providers.Provider): Contract {
return new Contract(address, ABI, provider);
}
```

7. In the `contracts/package.json`, add a script to compile TypeScript files:

```json
"scripts": {
// ...
"compile": "tsc",
// ...
},
```

8. Run `lerna bootstrap` to install dependencies for all packages in the monorepo and make sure everything is up-to-date.

9. Run `lerna run build` to compile TypeScript files and build your contracts.
