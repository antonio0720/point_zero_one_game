import { ethers } from "hardhat";
import { expect } from "chai";
import { VersioningContract } from "../typechain";
import { deployContract } from "./helpers/deployments";

describe("Versioning Contract", function () {
let versioning: VersioningContract;

beforeEach(async function () {
const accounts = await ethers.getNamedSigners();
this.accounts = accounts;

const deployment = await deployContract("Versioning", []);
versioning = await ethers.getContractAt("Versioning", deployment.address);
});

it("should emit a VersionChanged event after setting the new version", async function () {
const currentVersion = await versioning.version();

// Set a new version and check if an event is emitted
await expect(versioning.setVersion(1))
.to.emit(versioning, "VersionChanged")
.withArgs(currentVersion + 1);
});

it("should revert when trying to set a version lower than the current one", async function () {
const currentVersion = await versioning.version();

// Attempt to revert the version
await expect(versioning.setVersion(currentVersion - 1)).to.be.revertedWith("New version must be greater than the current one");
});
});
