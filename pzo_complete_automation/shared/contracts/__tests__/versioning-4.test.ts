import { ethers } from "hardhat";
import { Versioning4 } from "../contracts/Versioning4";
import { expect } from "chai";

describe("Versioning4", function () {
let versioning4: Versioning4;
let owner: any;
let addr1: any;
let addr2: any;

beforeEach(async function () {
[owner, addr1, addr2] = await ethers.getSigners();

const Versioning4Contract = await ethers.getContractFactory("Versioning4");
versioning4 = await Versioning4Contract.deploy();
await versioning4.deployed();
});

it("Should set the correct initial version", async function () {
expect(await versioning4.version()).to.equal(1);
});

it("Should increment the version number correctly", async function () {
await versioning4.incrementVersion();
expect(await versioning4.version()).to.equal(2);
});

it("Should only allow the owner to increment the version", async function () {
await expect(addr1.call(versioning4, "incrementVersion")).to.be.revertedWith(
"Ownable: caller is not the owner"
);
});

it("Should return the current version in the view method", async function () {
await versioning4.incrementVersion();
expect((await versioning4.version()).toString()).to.equal("2");
});
});
