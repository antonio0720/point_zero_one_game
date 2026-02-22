import { ethers } from 'ethers';
import { deployContract } from '@ethereum-waffle';
import { Escrow } from '../contracts/Escrow';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('Escrow', () => {
let escrow: Escrow;
let deployer: SignerWithAddress;
let buyer: SignerWithAddress;
let seller: SignerWithAddress;

beforeEach(async () => {
[deployer, buyer, seller] = await ethers.getSigners();
const escrowContractFactory = await ethers.getContractFactory('Escrow');
escrow = await deployContract(deployer, escrowContractFactory);
});

it('should be able to deposit funds', async () => {
// add your test case here
});

it('should be able to withdraw funds after contract is completed', async () => {
// add your test case here
});

// Add more test cases as needed
});
