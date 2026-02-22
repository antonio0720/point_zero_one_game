import { ethers } from "hardhat";
import { VersioningV6 } from "../artifacts/contracts/ids/VersioningV6.sol/VersioningV6.json";

describe("VersioningV6", function () {
let versioningV6: any;
let owner: any;
let addr1: any;
let addr2: any;

beforeEach(async function () {
const VersioningV6Contract = await ethers.getContractFactory(VersioningV6.abi, VersioningV6.bytecode);
[owner, addr1, addr2] = await ethers.getSigners();
versioningV6 = await VersioningV6Contract.deploy();
await versioningV6.deployed();
});

it("Should set the correct initial version", async function () {
expect(await versioningV6.version()).to.equal(1);
});

it("Should increment and return the correct version after an update", async function () {
await versioningV6.updateVersion({ from: owner.address });
expect(await versioningV6.version()).to.equal(2);
});

it("Should revert when trying to update version by non-owner", async function () {
await expect(versioningV6.connect(addr1).updateVersion({ from: addr1.address })).to.be.revertedWith("Ownable: caller is not the owner");
});

it("Should revert when trying to update version with invalid data", async function () {
await expect(versioningV6.updateVersion({ from: owner.address, data: ethers.utils.parseBytes32String("Invalid Data") })).to.be.revertedWith("Version must be a number");
});
});
