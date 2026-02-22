import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import IntegrityContract from "../artifacts/contracts/Integrity.sol/Integrity.json";

describe("Signed Actions - SignedActions9", function () {
let integrity, owner: SignerWithAddress, account1: SignerWithAddress, account2: SignerWithAddress;
const actionHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("SignedActions9"));

beforeEach(async function () {
[owner, account1, account2] = await ethers.getSigners();

integrity = new ethers.Contract(
process.env.INTEGRITY_CONTRACT_ADDRESS || "",
IntegrityContract.abi,
owner
);
});

it("should correctly verify SignedActions9", async function () {
const r = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Hello from Account1"));
const s = (await account1.signMessage(ethers.utils.toUtf8Bytes(actionHash))).signature.slice(-4);
const v = await calculateV(r, s, actionHash);

expect(
await integrity.verifySignedAction(account1.address, actionHash, r, s, v)
).to.equal(true);
});

it("should correctly reject SignedActions9 with incorrect signature", async function () {
const r = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Hello from Account1"));
const sWrong = (await account2.signMessage(ethers.utils.toUtf8Bytes(actionHash))).signature.slice(-4);
const v = await calculateV(r, sWrong, actionHash);

expect(
await integrity.verifySignedAction(account1.address, actionHash, r, sWrong, v)
).to.equal(false);
});

it("should correctly reject SignedActions9 with non-existing account", async function () {
const r = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Hello from AccountNonExistent"));
const s = (await account1.signMessage(ethers.utils.toUtf8Bytes(actionHash))).signature.slice(-4);
const v = await calculateV(r, s, actionHash);

expect(
await integrity.verifySignedAction(account1.address, actionHash, r, s, v)
).to.equal(false);
});

async function calculateV(r: string, s: string, actionHash: string): Promise<number> {
const message = ethers.utils.solidityKeccak256(
["bytes32", "bytes", "bytes"],
[ethers.utils.keccak256(actionHash), r, s]
);
const sigWithoutV = ethers.utils.splitSignature(message);
return parseInt(sigWithoutV[1]) + 27;
}
});
