import * as anchorage from "@solana/anchor";
import { program } from "@solana/web3.js";
import * as assert from "assert";
import BN = anchorage.BN;

const provider = anchor.Provider.local();
const programID = new anchorage.web3.PublicKey(
"Your_Program_Id_Here"
);
const governance = new anchorage.AnchorProvider(
provider,
programID,
{}
);
const governanceProgram = new program.program(governance.programId);

async function executeProposal(proposalId: number, yesVotes: BN, noVotes: BN) {
const tx = await governance.startTransaction();
tx.add(
governanceProgram.methods.executeProposal(proposalId, yesVotes, noVotes).accounts({
proposalPda: anchorage.Utils.keccak256([
Buffer.from("governance"),
Buffer.from("proposal"),
new BN(proposalId).toArrayLikeBuffer("le", 8),
]),
governance: programID,
})
);
const signature = await tx.sign();
const result = await provider.sendAndConfirm(signature);
}
