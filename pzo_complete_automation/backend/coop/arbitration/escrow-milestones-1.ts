import { Contract, Address, bytes, BigInt } from "@near/near-sdk";

export class EscrowMilestones extends Contract {
private milestones: Map<string, [BigInt, BigInt]> = new Map();
private current_milestone_index: BigInt = BigInt(0);
private projectOwner: Address;
private contractOwner: Address;

constructor() {
super();
this.projectOwner = this.storageWrap().get("projectOwner") as Address;
this.contractOwner = this.getAccountId();
}

public async createProject(project_name: string, initial_funds: BigInt): Promise<void> {
const nonce = await this.storageWrap().put(project_name, "");
this.milestones.set(project_name, [BigInt(0), initial_funds]);
this.current_milestone_index = BigInt(0);
}

public async fundMilestone(project_name: string, amount: BigInt): Promise<void> {
if (!this.milestones.has(project_name)) {
throw new Error("Project not found");
}

const [current_index, total_funds] = this.milestones.get(project_name)!;
if (current_index < BigInt(this.milestones.size)) {
throw new Error("Current milestone is not fully funded");
}

const [next_funds, _] = this.milestones.get(project_name)!;
const current_balance = await this.storageWrap().get<BigInt>("balance") as BigInt;
if (current_balance < amount) {
throw new Error("Insufficient funds");
}

this.storageWrap().put("balance", current_balance - amount);
this.milestones.set(project_name, [BigInt(this.current_milestone_index.add(BigOne)), next_funds.add(amount)]);
this.current_milestone_index = this.current_milestone_index.add(BigOne);
}

public async releaseFunds(project_name: string, _: Uint8Array): Promise<void> {
if (!this.milestones.has(project_name)) {
throw new Error("Project not found");
}

const [_, total_funds] = this.milestones.get(project_name)!;
const projectOwner = await this.storageWrap().get<Address>("projectOwner") as Address;
if (this.getAccountId() !== projectOwner) {
throw new Error("Only the project owner can release funds");
}

this.storageWrap().put("balance", this.storageWrap().get<BigInt>("balance") as BigInt).then(() => {
this.milestones.delete(project_name);
this.current_milestone_index = BigInt(0);
});
}
}
