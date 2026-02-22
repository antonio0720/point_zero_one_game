import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Versioning3 } from '../../contracts/ids/versioning-3';

describe('Versioning3', function () {
let versioning3: Versioning3;
let owner: any;
let addr1: any;
let addr2: any;

beforeEach(async function () {
[owner, addr1, addr2] = await ethers.getSigners();

const Versioning3Contract = await ethers.getContractFactory('Versioning3');
versioning3 = await Versioning3Contract.deploy();
await versioning3.deployed();
});

it('should set the correct initial version number', async function () {
expect(await versioning3.version()).to.equal(1);
});

// Add more test cases here...
});
