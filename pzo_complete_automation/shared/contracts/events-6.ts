import { ethers } from "hardhat";
import { ContractFactory, Interface, constants } from ethers;
import { AddressZero } from "@openzeppelin/upgrades-core";

const EventInterface = new Interface([
"event MyEvent(address indexed _sender, uint256 indexed _id, string memory _data)",
]);

async function deployMyContract() {
const MyContract = await ethers.getContractFactory("MyContract");
const myContract = await MyContract.deploy();
await myContract.deployed();

console.log(`MyContract deployed to: ${myContract.address}`);

// Example of listening to an event using Hardhat's console.log
myContract.on("MyEvent", (sender, id, data) => {
console.log(`Event triggered by ${sender.toString()} with ID ${id} and data ${data}`);
});
}

deployMyContract()
.then(() => process.exit(0))
.catch((error) => {
console.error(error);
process.exit(1);
});
