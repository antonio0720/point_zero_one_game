import { ethers } from 'ethers';
import { expect } from 'chai';
import { deployContract, erc165 } from '@openzeppelin/test-helpers';
import Versioning7Artifact from '../../artifacts/contracts/versioning-7.sol/Versioning7.json';

describe('Versioning7', function () {
let versioning7: any;
let provider: any;
let owner: any;
let addr1: any;
let addr2: any;

beforeEach(async function () {
provider = ethers.provider;
[owner, addr1, addr2] = await ethers.getSigners();

const versioning7ContractFactory = new ethers.ContractFactory(
Versioning7Artifact.abi,
Versioning7Artifact.bytecode,
owner
);

versioning7 = await versioning7ContractFactory.deploy();
await versioning7.deployed();
});

describe('Deployment', function () {
it('Should set the correct contract name', async function () {
const name = await erc165(versioning7.address).getName();
expect(name).to.equal('Versioning7');
});
});

describe('Basic functionality', function () {
it('Should increment version correctly', async function () {
// Test case for incrementing version number
});

it('Should return correct version number', async function () {
// Test case for checking the returned version number
});
});
});
