import { Contract, accounts, Event, constants } from "ethers";
import { Interface } from "@ethersproject/abi";

export interface EscrowEvent {
projectId: string;
funderAddress: string;
workerAddress: string;
amount: number;
}

const ESCROW_ABI = [
"event EscrowCreated(uint256 indexed _projectId, address indexed _funder, address indexed _worker, uint256 _amount)",
"event FundsReleased(uint256 indexed _projectId, address _funder, address _worker)",
];

const escrowInterface = new Interface(ESCROW_ABI);

export class EscrowContract extends Contract {
constructor(signerOrProvider: any) {
super(ESCROW_ABI, constants.AddressZero, signerOrProvider);
}

async createEscrow(projectId: string, funderAddress: string, workerAddress: string, amount: number): Promise<void> {
await this.executeTransactionAndWait("createEscrow", [projectId, funderAddress, workerAddress, amount]);
}

async releaseFunds(projectId: string): Promise<void> {
await this.executeTransactionAndWait("releaseFunds", [projectId]);
}

listenForEvents(): void {
this.on("EscrowCreated", (projectId, funderAddress, workerAddress, amount) => {
console.log(`Event EscrowCreated: projectId=${projectId} funder=${funderAddress} worker=${workerAddress} amount=${amount}`);
const eventData: EscrowEvent = { projectId, funderAddress, workerAddress, amount };
this.onEscrowCreated(eventData);
});

this.on("FundsReleased", (projectId, funderAddress, workerAddress) => {
console.log(`Event FundsReleased: projectId=${projectId} funder=${funderAddress} worker=${workerAddress}`);
const eventData: EscrowEvent = { projectId, funderAddress, workerAddress, amount: 0 }; // Set the amount to zero as it's not provided in this event
this.onFundsReleased(eventData);
});
}

onEscrowCreated?: (data: EscrowEvent) => void;
onFundsReleased?: (data: EscrowEvent) => void;
}
