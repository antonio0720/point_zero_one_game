import { Contract, ContractFactory, constants, ethers } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, providers, utils } from "ethers";
import { deployments, ethers, network, upgrades } from "hardhat";
import { Kernel__factory } from "../factories/Kernel__factory";
import { CECL_V1__factory } from "../factories/CECL_V1__factory";

describe("Crash Loop Recovery - Test 3", function () {
let kernel: Contract;
let ceclV1: Contract;
let kernelFactory: ContractFactory;
let ceclV1Factory: ContractFactory;
let accounts: SignerWithAddress[];

beforeEach(async function () {
accounts = await ethers.getSigners();

kernelFactory = new Kernel__factory(accounts[0]);
ceclV1Factory = new CECL_V1__factory(accounts[0]);

const kernelDeployment = await deployments.get("Kernel");
const ceclV1Deployment = await deployments.get("CECL_V1");

kernel = await ethers.getContractAt("Kernel", kernelDeployment.address);
ceclV1 = await ethers.getContractAt(
"CECL_V1",
ceclV1Deployment.address
);
});

// Add your test cases here
});
