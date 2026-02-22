import { ethers } from 'hardhat';
import { Versioning5 } from '../contracts/versioning-5';
import chai from 'chai';
const { expect } = chai;

describe('Versioning5', function () {
let versioning5: Versioning5;
let owner: any;
let addr1: any;
let addr2: any;

beforeEach(async function () {
[owner, addr1, addr2] = await ethers.getSigners();
const Versioning5 = await ethers.getContractFactory('Versioning5');
versioning5 = await Versioning5.deploy();
await versioning5.deployed();
});

it('Should set the correct initial version', async function () {
expect(await versioning5.version()).to.equal('1.0.0');
});

it('Should increment the version number after deploying a new contract', async function () {
const Versioning6 = await ethers.getContractFactory('Versioning6');
const instance = await Versioning6.deploy();
await instance.deployed();

expect(await versioning5.version()).to.equal('1.0.1');
});
});
