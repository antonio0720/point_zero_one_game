import { Contract, accounts, BigNumber, utils } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

export class Voting7 extends Contract {
constructor(hre: HardhatRuntimeEnvironment) {
super(utils.getAddress("0x298436E5Cd53F1A55f4b8c5B306eE283D1C36287"), hre);
}

async castVote(proposalId: number, support: boolean) {
await this.execute(
"castVote",
[proposalId, support ? BigNumber.from(1) : BigNumber.from(0)]
);
}

async voteTotal(proposalId: number) {
const voteCounts = await this.callStatic("getVotes", [proposalId]);
return voteCounts[1].sub(voteCounts[2]);
}

async getProposals() {
const proposalList = await this.callStatic("getProposals");
return proposalList;
}

async proposalOwner(proposalId: number) {
const proposalDetails = await this.callStatic("getProposals", [proposalId]);
return proposalDetails[0];
}
}

export function deployVoting7(hre: HardhatRuntimeEnvironment) {
const contractFactory = hre.ethers.getContractFactory("Voting7");
const coop = hre.deployments.getOrNull("Coop");
if (coop === null) throw new Error("Coop not deployed!");

return contractFactory.deploy(coop.address);
}
