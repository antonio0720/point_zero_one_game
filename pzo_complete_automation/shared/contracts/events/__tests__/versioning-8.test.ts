import { ethers } from 'ethers';
import { expect } from 'chai';
import { deployContract, erc20ABI, erc721ABI } from '../../helpers';
import Versioning8 from '../../contracts/Versioning-8.sol';

describe('Versioning-8', function () {
let versioning: any;
let provider: any;
let signer: any;

beforeEach(async function () {
provider = ethers.provider;
signer = await ethers.getSigner();
versioning = await deployContract(signer, Versioning8, []);
});

it('should set the correct name and symbol', async function () {
const name = await versioning.name();
const symbol = await versioning.symbol();
expect(name).to.equal('Versioning-8');
expect(symbol).to.equal('V8');
});

it('should increment the version number', async function () {
await versioning.incrementVersion();
const newVersion = await versioning.version();
expect(newVersion).to.equal(1);
});

it('should emit an event when the version is incremented', async function () {
await expect(versioning.incrementVersion())
.to.emit(versioning, 'VersionIncremented')
.withArgs(0, 1);
});

// Add more test cases as needed
});
