import { expect } from 'chai';
import { BigNumber } from 'bignumber.js';
import { ethers, deployments, network } from 'hardhat';
import { BalanceKeeper, BalanceKeeper__factory } from '../typechain';

const { deploy } = deployments;

describe('Balance Keeper - Test Case 11', function () {
let balanceKeeper: BalanceKeeper;
let owner: any;
let addr1: any;
let addr2: any;

beforeEach(async function () {
await hre.network.provider.request({
method: 'hardhat_reset',
});

await hre.run('deploy-balance-keeper');

[owner, addr1, addr2] = await ethers.getSigners();

balanceKeeper = await BalanceKeeper__factory.fromSignature(await deploy('BalanceKeeper'));
});

it('Test Case 11: Should correctly transfer and update balances when multiple transactions are executed', async function () {
// Setup initial balances
const initialOwnerBalance = BigNumber(1000).times(BigNumber(1e18));
const initialAddr1Balance = BigNumber(2000).times(BigNumber(1e18));
const initialAddr2Balance = BigNumber(3000).times(BigNumber(1e18));

await balanceKeeper.deposit({ value: initialOwnerBalance });
await balanceKeeper.connect(addr1).deposit({ value: initialAddr1Balance });
await balanceKeeper.connect(addr2).deposit({ value: initialAddr2Balance });

// Check initial balances
expect(await balanceKeeper.balanceOf(owner.address)).to.equal(initialOwnerBalance);
expect(await balanceKeeper.balanceOf(addr1.address)).to.equal(initialAddr1Balance);
expect(await balanceKeeper.balanceOf(addr2.address)).to.equal(initialAddr2Balance);

// Execute multiple transactions
const amountToTransfer = BigNumber(500).times(BigNumber(1e18));
await balanceKeeper.connect(owner).transfer(addr1.address, amountToTransfer);
await balanceKeeper.connect(addr1).transfer(addr2.address, amountToTransfer);
await balanceKeeper.connect(addr2).transfer(owner.address, amountToTransfer);

// Check updated balances
expect(await balanceKeeper.balanceOf(owner.address)).to.equal(initialOwnerBalance.minus(amountToTransfer * 2));
expect(await balanceKeeper.balanceOf(addr1.address)).to.equal(initialAddr1Balance.plus(amountToTransfer).minus(amountToTransfer));
expect(await balanceKeeper.balanceOf(addr2.address)).to.equal(initialAddr2Balance.plus(amountToTransfer).minus(amountToTransfer));
});
});
