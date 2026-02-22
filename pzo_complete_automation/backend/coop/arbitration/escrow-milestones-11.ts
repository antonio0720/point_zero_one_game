import { Contract } from 'ethers';
import { Escrow, EscrowMilestones } from '@openzeppelin/contracts';
import { hardhatUtils } from './utils/hardhat-utils';

const COOPERATIVE_CONTRACT = '0x...'; // Replace with your cooperative contract address
const INITIAL_TOTAL_COIN_SUPPLY = BigInt(1000000000000000000); // 10^18 (Wei)
const MILESTONE_DEPOSIT = BigInt(500000000000000); // 500 Wei
const NUM_MILESTONES = 4;

async function main() {
const signers = await ethers.getSigners();
const deployer = signers[0];

const Escrow = await ethers.getContractFactory('Escrow', deployer);
const escrow = await Escrow.deploy(COOPERATIVE_CONTRACT, INITIAL_TOTAL_COIN_SUPPLY);
await escrow.deployed();

const Milestones = await ethers.getContractFactory('EscrowMilestones', deployer);
const escrowMilestones = await Milestones.deploy(escrow.address, MILESTONE_DEPOSIT, NUM_MILESTONES);
await escrowMilestones.deployed();

// Set cooperative as the owner of the milestone contract
await hardhatUtils.setOwner(escrowMilestones.address, deployer.address);
}

main()
.then(() => process.exit(0))
.catch((error) => {
console.error(error);
process.exit(1);
});
