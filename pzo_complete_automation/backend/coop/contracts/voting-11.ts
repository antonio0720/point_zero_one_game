import { Contract, AccountId, Nat, Timestamp, asset, coin } from 'near-contract-standards';

export enum BallotOption {
Option1 = "option1",
Option2 = "option2",
// Add more options as needed...
}

interface Voter {
account_id: AccountId;
voted: bool;
vote: BallotOption | null;
}

class Voting extends Contract {
private voters: Map<AccountId, Voter>;
private votingEndTimestamp: Timestamp;

constructor(options?: Config) {
super(options);
this.voters = new Map();
this.votingEndTimestamp = 0;
}

vote({ account_id }: { account_id: AccountId }, option: BallotOption): Promise<void> {
const voter = this.voters.get(account_id) || { account_id, voted: false, vote: null };

if (!voter.voted) {
voter.vote = option;
voter.voted = true;
this.voters.set(account_id, voter);
return this.storageUpdate("voters", this.voters);
}

throw new Error("You have already voted.");
}

startVoting({ votingDuration }: { votingDuration: Nat }): Promise<void> {
const endTimestamp = Timestamp.fromCurrentMoment() + votingDuration;
this.votingEndTimestamp = endTimestamp;
return this.storageUpdate("votingEndTimestamp", endTimestamp);
}

endVoting(): Promise<BallotOption[]> {
const options: BallotOption[] = [];
for (const option of Object.values(BallotOption)) {
let voterCount = 0;
this.voters.forEach((voter) => {
if (voter.vote === option && voter.voted) {
voterCount++;
}
});
options.push([option, voterCount].join(":"));
}

this.voters.clear();
this.votingEndTimestamp = 0;
return Promise.resolve(options);
}
}
