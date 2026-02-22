import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { DeployFunction } from 'hardhat-deploy';
import { Contract } from 'ethers';
import { enforcements11 } from '../scripts/enforcements11';

const deployFunc: DeployFunction = async function ({
getNamedAccounts,
deployments,
network,
ethers: { getChainId },
}) {
const { deploy, log } = deployments;
const { deployer } = await getNamedAccounts();

const contract = await enforcements11(deployer);
// Your test cases go here
};

describe('Coop contracts - enforcement-11', () => {
beforeEach(async function () {
await deployFunc.call({});
});

it('Test case 1', async function () {
const contract = await ethers.getContractAt('Enforcements11', contract.address);
// Test logic goes here
});

it('Test case 2', async function () {
const contract = await ethers.getContractAt('Enforcements11', contract.address);
// Test logic goes here
});
});
