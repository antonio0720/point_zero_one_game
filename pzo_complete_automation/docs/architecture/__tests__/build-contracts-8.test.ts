import { Contract, ethers } from 'ethers';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import * as fs from 'fs';
import * as path from 'path';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const contractName = 'Contract8';
const artifactPath = path.join(__dirname, `../artifacts/${contractName}.sol/${contractName}.json`);

const functionName = 'myFunction';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
const { getNamedAccounts, deployments } = hre;
const { deploy, log } = deployments;

const account = await getNamedAccounts().deployer;

const contract = await deploy(contractName, {
from: account,
// Any other deployment options...
});

log(`${contractName} deployed to ${contract.address}`);

// Test the function here
const contractInstance = new Contract(contract.address, artifactPath as string, hre.ethers.provider);
await contractInstance[functionName]().then((result) => {
log(`${functionName} called with result: ${result}`);
}).catch((error) => {
log(`Error calling ${functionName}:`, error);
});
};

export default deployFunction;
