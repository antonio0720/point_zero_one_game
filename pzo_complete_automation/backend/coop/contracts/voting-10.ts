import { Contract } from 'fabric-contract-api';
import * as uuid from 'uuid';

class VotingContract extends Contract {
constructor() {
super('voting');
}

async initLedger(stub: ContractStub) {
await stub.putState('vote1', Buffer.fromJSON({ name: 'Initial Vote', startDate: new Date(), endDate: new Date().setDate(new Date().getDate() + 7), votes: [] }));
}

async createVote(stub: ContractStub, voteName: string, startDate: Date, endDate: Date): Promise<void> {
const voteId = uuid.v4();
const existingVoteState = await stub.getState('vote' + voteId);

if (existingVoteState && existingVoteState.toString().length > 0) {
throw new Error(`The state with id: ${voteId} already exists`);
}

const vote = { name: voteName, startDate: startDate, endDate: endDate, voters: [] };
await stub.putState('vote' + voteId, Buffer.fromJSON(vote));
}

async addVote(stub: ContractStub, voteId: string, voter: string): Promise<void> {
const vote = await stub.getState('vote' + voteId);
if (!vote || vote.toString().length <= 0) {
throw new Error(`The state with id: ${voteId} does not exist`);
}
const voters = vote.readJSON().voters;
if (voters.includes(voter)) {
throw new Error(`Voter ${voter} has already voted on this vote`);
}
voters.push(voter);
await stub.putState('vote' + voteId, Buffer.fromJSON({ ...vote.readJSON(), voters }));
}

async countVotes(stub: ContractStub, voteId: string): Promise<string[]> {
const vote = await stub.getState('vote' + voteId);
if (!vote || vote.toString().length <= 0) {
throw new Error(`The state with id: ${voteId} does not exist`);
}
return vote.readJSON().voters;
}
}

export default VotingContract;
