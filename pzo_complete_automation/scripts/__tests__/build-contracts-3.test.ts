import { ethers } from 'hardhat';
import { expect } from 'chai';
import { deployments, ethers } from 'hardhat';
import { defineFixture } from '@ethereum-waffle';

// Define a fixture to recreate the contract deployment and state every test run
const deployContract = defineFixture(async () => {
const Contract = await ethers.getContractFactory('MyContract');
const contract = await Contract.deploy();
await contract.deployed();

return { contract };
});

describe('MyContract', function () {
beforeEach(async function () {
await deployments.fixture(deployContract);
});

it('should deploy successfully', async function () {
expect(this.contract.address).to.be.properAddress;
});

// Add more test cases here
});
