import { Awaitable } from '@polkadot/types/util';
import { expect } from 'chai';
import { createTypeRegistry } from '@polkadot/type-registry';
import { ethers } from 'ethers';
import { Contract, Signer, providers } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy';
import { EscrowMilestones9__factory, TokenERC20__factory } from '../typechain';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
// set up accounts
const [owner, account1, account2] = await ethers.getSigners();

// import and deploy contract factories
const EscrowMilestones9 = await ethers.getContractFactory('EscrowMilestones9', owner);
const tokenERC20 = await ethers.getContractFactory('TokenERC20');

// deploy test tokens
const token = await (await tokenERC20.deploy()).deployed();
await token.mint(owner.address, ethers.utils.parseEther('1000'));

// deploy EscrowMilestones9 contract
const escrow = await EscrowMilestones9.deploy(token.address);
await escrow.deployed();

// tests go here
};

describe('EscrowMilestones9', function () {
let escrow: Contract;
let token: Contract;
let owner: Signer;
let account1: Signer;
let account2: Signer;
let provider: providers.Provider;

beforeEach(async function () {
// set up accounts and contract instances for each test
[owner, account1, account2] = await ethers.getSigners();
token = await ethers.getContractAt('TokenERC20', 'TOKEN_ADDRESS');
escrow = await ethers.getContractAt('EscrowMilestones9', 'ESCROW_CONTRACT_ADDRESS');
provider = ethers.provider;
});

it('should ...', async function () {
// add test case logic here
});

it('should ...', async function () {
// add another test case logic here
});
});
