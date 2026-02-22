import { BaseKernel } from "@celo/base-kernel";
import { Governance } from "@celo/protocol/lib/contracts/Governance";
import { CECLV1 } from "@celo/protocol/lib/contracts/lending/CECL_v1";

export class Checkpoint4Kernel extends BaseKernel {
async main() {
const governance = await Governance.deploy(this.accounts);
const ceclV1 = await CECLV1.deploy(this.accounts, governance.address);

// Set the initial configuration for CECL_v1 contract
await governance.methods.proposeContractConfiguration(ceclV1.address, []);
await governance.methods.vote(0, true); // vote YES on the proposal
await this.mineBlock();
await governance.methods.executeProposedActionAt(0);

// Set the CECL_v1 parameters here if needed (e.g., interest rates, risk parameters)

// Deploy additional contracts as necessary for your application
}
}
