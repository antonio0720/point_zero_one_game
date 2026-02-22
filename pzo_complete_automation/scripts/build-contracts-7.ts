import * as Hardhat from 'hardhat';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import path from 'path';
import fs from 'fs';
import { ethers } from 'ethers';

const BASE_DIR = path.join(__dirname, '..');
const SOURCE_DIR = path.join(BASE_DIR, 'contracts');
const ARTIFACTS_DIR = path.join(BASE_DIR, 'artifacts');

async function main(hre: HardhatRuntimeEnvironment) {
const networkName = hre.network.name;
const accounts = await hre.ethers.getSigners();

// Read the source files for the contract you want to build
const contractPaths = [
path.join(SOURCE_DIR, 'MyContract.sol'),
path.join(SOURCE_DIR, 'MyOtherContract.sol'),
// Add more contracts as needed
].map((p) => fs.readFileSync(p, 'utf-8'));

const compiledContracts = await hre.run('compile', {
verbose: false,
outputDir: ARTIFACTS_DIR,
sourcePaths: [SOURCES_DIR],
});

const contractArtifacts = contractPaths.map((contractCode, index) => {
const artifact = compiledContracts[index];
const contractName = path.basename(contractPaths[index]).replace('.sol', '');

return {
abi: JSON.parse(artifact.abi),
bytecode: '0x' + artifact.bin,
network: networkName,
address: await deployContract(hre, accounts[0], contractName),
};
});

fs.writeFileSync(
path.join(ARTIFACTS_DIR, `${networkName}-deployments.json`),
JSON.stringify({ contracts: contractArtifacts }, null, 2)
);
}

async function deployContract(hre: HardhatRuntimeEnvironment, signer: ethers.Signer, name: string) {
const Factory = await hre.ethers.getContractFactory(name);
return await Factory.deploy().then((contract) => contract.deployed());
}

const runMain = async () => {
try {
await hre.run('network', { verbose: false, networkName: 'hardhat' });
await main(hre);
} catch (error) {
console.error(error);
process.exitCode = 1;
}
};

runMain();
