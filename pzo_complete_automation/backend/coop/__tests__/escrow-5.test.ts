import { ethers } from 'hardhat';
import { Contract, Signer, Wallet } from 'ethers';
import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { BigNumber } from 'bignumber.js';

chai.use(solidity);

describe('Escrow5', function () {
let escrowContract: Contract;
let owner: Signer;
let addr1: Signer;
let addr2: Signer;
let addr3: Signer;

beforeEach(async function () {
[owner, addr1, addr2, addr3] = await ethers.getSigners();

const Escrow5 = await ethers.getContractFactory('Escrow5');
escrowContract = await Escrow5.deploy();
await escrowContract.deployed();
});

it('Should initialize with correct owner', async function () {
expect(await escrowContract.owner()).to.equal(owner.address);
});

it('Should execute escrow correctly between two addresses', async function () {
const amount = new BigNumber(10).times(1e18); // 10 ether

await escrowContract.startEscrow(addr1.address, addr2.address, amount, { value: amount });

expect(await escrowContract.getBalance(addr1.address)).to.equal('0');
expect(await escrowContract.getBalance(addr2.address)).to.equal('0');

await addr1.sendTransaction({ to: escrowContract.address, value: amount });
await network.provider.send('evm_mine', []);

expect(await escrowContract.getBalance(addr1.address)).to.equal('0');
expect(await escrowContract.getBalance(addr2.address)).to.be.closeTo(amount, amount.times(0.01));
});

it('Should fail when trying to execute the escrow twice', async function () {
const amount = new BigNumber(10).times(1e18); // 10 ether

await escrowContract.startEscrow(addr1.address, addr2.address, amount, { value: amount });

await expect(escrowContract.connect(addr1).startEscrow(addr2.address, addr3.address, amount)).to.be.rejected;
});
});
