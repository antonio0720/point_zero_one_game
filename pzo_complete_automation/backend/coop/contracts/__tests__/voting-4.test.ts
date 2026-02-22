import { ethers } from "hardhat";
import { expect } from "chai";
import { Voting4 } from "../../../artifacts/contracts/Voting4.sol/Voting4.json";

describe("Voting4", function () {
let voting4: any;
let owner: any;
let addr1: any;
let addr2: any;

beforeEach(async function () {
const Voting4Contract = await ethers.getContractFactory(Voting4.abi, Voting4.bytecode);
[owner, addr1, addr2] = await ethers.getSigners();
voting4 = await Voting4Contract.deploy();
await voting4.deployed();
});

it("Should initialize the contract with correct values", async function () {
expect(await voting4.name()).to.equal("Voting4");
expect(await voting4.symbol()).to.equal("VTG4");
});

it("Should not allow non-owner to propose new proposal", async function () {
await expect(voting4.connect(addr1).propose("Test Proposal", "Yes"))
.to.be.revertedWith("Ownable: caller is not the owner");
});

it("Should allow owner to propose new proposal", async function () {
const proposalHash = ethers.keccak256(ethers.utils.toUtf8Bytes("Test Proposal"));
await voting4.propose("Test Proposal", "Yes", { from: owner });
expect(await voting4.getProposalByIndex(0)).to.deep.equal({
proposalHash,
description: "Yes",
voters: [],
voteCounts: [0, 0],
startTime: ethers.constants.ZeroAddress,
endTime: ethers.constants.ZeroAddress,
});
});

// Add more test cases as needed...
});
