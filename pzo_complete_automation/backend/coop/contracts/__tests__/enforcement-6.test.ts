import { expect } from "chai";
import { BigNumber, ethers } from "ethers";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { ZERO_ADDRESS, ZERO_DIX } from "../helpers/constants";
import { CoopContracts } from "../../typechain";

describe("Coop contracts - enforcement-6", function () {
let deployer: Deployer;
let coopContract: CoopContracts;

before(async function () {
this.timeout(120000);
deployer = new Deployer({
ethers,
account: (await ethers.getSigners())[0],
network: "localhost",
});

await deployer.deploy("CoopContracts");
coopContract = await deployer.getArtifact("CoopContracts").then((art) => new art.ethers.Contract(coopContract.address, coopContract.abi, deployer.provider));
});

describe("enforcement6", function () {
it("Should return true when input is correct", async function () {
const input = ethers.utils.parseBytes32String("test");
expect(await coopContract.enforcement6(input)).to.equal(true);
});

it("Should return false when input is not correct", async function () {
const input = ethers.utils.parseBytes32String("test123");
expect(await coopContract.enforcement6(input)).to.equal(false);
});
});
});
