import { Contract } from 'quasar-framework';
import { Proposal, Voter, Vote } from './types';

export class VotingContract extends Contract {
public async createProposal(proposer: Voter, proposalContent: string): Promise<Proposal> {
const proposalId = await this.getNextId('proposals');
const proposal = { id: proposalId, proposer, content: proposalContent } as Proposal;
await this.db.add(this.collection('proposals'), proposal);
return proposal;
}

public async vote(voter: Voter, proposalId: string, voteOption: 'for' | 'against'): Promise<Vote> {
const voterId = await this.getUserIdFromAccount(voter);
const voteId = await this.getNextId('votes');
const vote = { id: voteId, voterId, proposalId, option: voteOption } as Vote;
await this.db.add(this.collection('votes'), vote);
return vote;
}

public async countVotes(proposalId: string): Promise<{ for: number, against: number }> {
const votes = await this.db.find(this.collection('votes'), { proposalId }).toArray();
let forCount = 0;
let againstCount = 0;

votes.forEach((vote) => {
if (vote.option === 'for') {
forCount++;
} else {
againstCount++;
}
});

return { for: forCount, against: againstCount };
}

public async getProposals(): Promise<Proposal[]> {
return await this.db.find(this.collection('proposals')).toArray();
}

private async getUserIdFromAccount(account: Voter): Promise<string> {
const user = await this.db.findOne(this.collection('users'), { account });
return user._id;
}

private getNextId<T>(collection: string): (() => T['id']) {
let idCounter = Number((await this.db.find({}, { collection }).sort({ id: -1 }).limit(1)).next().id) + 1;
return () => `${collection}_${idCounter++}` as T['id'];
}
}
