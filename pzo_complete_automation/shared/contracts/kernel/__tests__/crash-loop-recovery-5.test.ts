import { ethers } from "hardhat";
import { expect } from "chai";
import { GovernanceKernel, CECL_V1 } from "../contracts/kernel";
import { BigNumber } from "ethers";

describe("Governance kernel + CECL_v1 - crash-loop-recovery-5", function () {
let governance: GovernanceKernel;
let cecl: CECL_V1;
let deployer: any;
let addr1: any;
let addr2: any;
let initialFunds: BigNumber;

beforeEach(async function () {
[deployer, addr1, addr2] = await ethers.getSigners();

const GovernanceKernelContract = await ethers.getContractFactory("GovernanceKernel");
governance = await GovernanceKernelContract.deploy();
await governance.deployed();

const CECL_V1Contract = await ethers.getContractFactory("CECL_V1");
cecl = await CECL_V1Contract.deploy(governance.address);
await cecl.deployed();

initialFunds = await deployer.getBalance();
await deployer.transfer(governance.address, initialFunds);
});

// Add your test cases here
});
