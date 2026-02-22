import * as path from 'path';
import * as fs from 'fs';
import * as program from 'commander';
import { HardhatProject } from 'hardhat/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { SubstrateNetworkConfig } from '@substrate/polywrap-wasm-execution-environment';
import { ChainSpec, WsProvider } from '@polkadot/api';
import * as dotenv from 'dotenv';

const project: HardhatProject = {
name: 'one-command-stack-1',
};

const setup = async (hre: HardhatRuntimeEnvironment) => {
// Load .env file for network and account details
dotenv.config();

// Set up the Substrate network configuration
const chainSpec: ChainSpec = JSON.parse(
fs.readFileSync(path.resolve(__dirname, './network/local.json')).toString()
);
const provider = new WsProvider(chainSpec.WSRPC);
const api = await provider.send('eth_requestId', [1]); // Request unique JSON-RPC request ID
const networkConfig: SubstrateNetworkConfig = {
api,
chainSpec,
rpcUrl: chainSpec.RPCNodeUrl,
signerUrl: chainSpec.WSRPC,
type: 'substrate',
ss58Format: chainSpec.SS58Format,
};

// Set up Hardhat to use the Substrate network configuration
hre.networks[chainSpec.name] = {
provider: () => networkConfig,
accounts: [process.env.SUBSTRATE_ACCOUNT_PRIVATE_KEY],
chainId: chainSpec.chainId,
};
};

program
.command('deploy')
.description('Deploys the contract to local substrate network')
.action(() => {
// Deployment logic goes here
});

program.parse(process.argv);

// Call setup function on Hardhat initialization
require('hardhat').run(setup, project);
