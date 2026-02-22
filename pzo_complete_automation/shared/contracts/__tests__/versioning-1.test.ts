import { ethers } from 'hardhat';
import { expect } from 'chai';
import { Versioning1 } from '../../../artifacts/contracts/Versioning.sol/Versioning1.json';

describe('Versioning1', function () {
let versioning: any;
const provider = ethers.provider;

beforeEach(async function () {
this.signers = await ethers.getSigners();
const Versioning1 = new ethers.ContractFactory(
JSON.parse(JSON.stringify(Versioning1.abi)).reverse(),
JSON.parse(JSON.stringify(Versioning1.bytecode)).reverse(),
this.signers[0]
);
versioning = await Versioning1.deploy();
await versioning.deployed();
});

it('should set the correct initial version', async function () {
expect(await versioning.version()).to.equal('1');
});

it('should increase the version number on each call to increaseVersion', async function () {
await versioning.increaseVersion();
expect(await versioning.version()).to.equal('2');
await versioning.increaseVersion();
expect(await versioning.version()).to.equal('3');
});
});
