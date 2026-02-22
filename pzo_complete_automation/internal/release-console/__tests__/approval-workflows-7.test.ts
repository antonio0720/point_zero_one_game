import * as assert from 'assert';
import { ethers } from 'hardhat';
import { BigNumber, Signer } from 'ethers';
import { ApprovalWorkflows7 } from '../artifacts/contracts/ApprovalWorkflows7.sol/ApprovalWorkflows7.json';
import { deployContract } from '../../scripts/deploy-contract';

describe('ApprovalWorkflows7', function () {
let approver: Signer;
let spender: Signer;
let owner: Signer;
let approvalWorkflows7: ApprovalWorkflows7;

beforeEach(async function () {
[owner, approver, spender] = await ethers.getSigners();

const ApprovalWorkflows7ContractFactory = new ethers.ContractFactory(
ApprovalWorkflows7.abi,
ApprovalWorkflows7.bytecode,
owner
);
approvalWorkflows7 = await ApprovalWorkflows7ContractFactory.deploy();
await approvalWorkflows7.deployed();
});

describe('Deployment', function () {
it('Should set the correct owner', async function () {
const ownerOfApprovalWorkflows7 = await approvalWorkflows7.owner();
assert.equal(ownerOfApprovalWorkflows7, owner.address);
});
});

describe('Simple Approval Workflow', function () {
let tokenAmount: BigNumber;

beforeEach(async function () {
tokenAmount = ethers.utils.parseEther('100');
});

it('Should not allow approve if the owner is not approver', async function () {
await assert.rejects(
approvalWorkflows7.connect(owner).approveOne(spender.address, tokenAmount),
/AccessControl: Account 0x.... not authorized to perform operation/
);
});

it('Should allow approve if the owner is approver', async function () {
await approvalWorkflows7.connect(approver).approveOne(spender.address, tokenAmount);
});

it('Should not allow spender to transfer token if it has not been approved', async function () {
await assert.rejects(
owner.sendTransaction({
to: spender.address,
value: tokenAmount,
}),
/Transfer helper: ApprovalWorkflows7: Transfer from 0x.... to 0x.... not approved/
);
});

it('Should allow spender to transfer token after approval', async function () {
await approvalWorkflows7.connect(approver).approveOne(spender.address, tokenAmount);
await owner.sendTransaction({
to: spender.address,
value: tokenAmount,
});
});
});
});
