import { expect } from 'chai';
import { BigNumber, providers, utils } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy';
import { VerificationUtils, verifyContract } from '../helpers/verify';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
const { getNamedAccounts, deployments, network, ethers } = hre;
const { deploy, log } = deployments;
const { developementChains } = utils;

const { deployer } = await getNamedAccounts();

const contract = await deploy('DeterministicReplay13', {
from: deployer,
args: [],
log: true,
deterministicDeployment: true,
});

if (
!developementChains.includes(network.name) &&
process.env.ETHERSCAN_API_KEY
) {
log('Verifying...');
await verifyContract(hre, contract.address, ['DeterministicReplay13'], []);
}

describe('DeterministicReplay13', function () {
const provider = new ethers.providers.JsonRpcProvider(
network.provider as string
);
const contractInstance = new ethers.Contract(contract.address, contract.abi, provider);

it('should return the correct value', async function () {
const result = await contractInstance.function1();
expect(result).to.equal(BigNumber.from(9));
});

it('should replay deterministically', async function () {
// Add your test cases for deterministic replay here
});
});
};

export default func;
