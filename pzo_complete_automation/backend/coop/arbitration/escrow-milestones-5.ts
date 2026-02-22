import '@nomiclabs/hardhat-ethers';
import { Contract, BigNumber, Signer } from 'ethers';

export enum EscrowMilestoneEvent {
Init = "Init",
FundingStarted = "FundingStarted",
ProjectStarted = "ProjectStarted",
MilestoneReached = "MilestoneReached",
FundsReleased = "FundsReleased",
ContractClosed = "ContractClosed"
}

export interface EscrowMilestones5 {
deploy(owner: Signer): Promise<EscrowMilestones5>;
fund(amount: BigNumber, milestone: number): Promise<void>;
startProject(): Promise<void>;
reachMilestone(index: number): Promise<void>;
releaseFunds(index: number): Promise<void>;
closeContract(): Promise<void>;
}

const ESCROW_MILESTONES5_ABI = [
// Solidity contract ABI for EscrowMilestones v5 goes here
];

async function getEscrowMilestones5(address: string): Promise<Contract> {
const provider = ethers.getDefaultProvider();
return new ethers.Contract(address, ESCROW_MILESTONES5_ABI as any[], provider);
}

export class EscrowMilestonesV5 implements EscrowMilestones5 {
private contract: Contract;

constructor(address?: string) {
if (address) {
this.contract = await getEscrowMilestones5(address);
}
}

async deploy(owner: Signer): Promise<this> {
const signer = owner instanceof ethers.Signer ? owner : await owner.getSigner();
const factory = await ethers.getContractFactory("EscrowMilestones5", signer);
this.contract = await factory.deploy();
return this;
}

async fund(amount: BigNumber, milestone: number): Promise<void> {
await this.contract.fund(milestone, { value: amount });
}

async startProject(): Promise<void> {
await this.contract.startProject();
}

async reachMilestone(index: number): Promise<void> {
await this.contract.reachMilestone(index);
}

async releaseFunds(index: number): Promise<void> {
await this.contract.releaseFunds(index);
}

async closeContract(): Promise<void> {
await this.contract.closeContract();
}
}
