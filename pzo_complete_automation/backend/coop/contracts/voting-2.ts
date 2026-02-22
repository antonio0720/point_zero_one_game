// voting-2.ts

import { Contract } from 'fabric-contract-api';
import { ChaincodeError } from './chaincodeError';

class VotingContract extends Contract {
constructor() {
super('Voting');
}

async initLedger(props: any) {}

// Create a new proposal
async createProposal(ctx, proposalId: string, proposer: string, title: string, description: string) {
const proposal = {
proposalId,
proposer,
title,
description,
voteCount: 0,
yesVotes: 0,
noVotes: 0,
abstainVotes: 0,
status: 'open',
};
await this.proposalsTable(ctx).put(proposalId, proposal);
}

// Query a specific proposal by ID
async queryProposal(ctx, proposalId: string) {
const proposalJSON = await this.proposalsTable(ctx).get(proposalId);
return proposalJSON && JSON.parse(proposalJSON.toString());
}

// Update a proposal with the outcome and close it
async updateProposal(ctx, proposalId: string, outcome: string) {
const proposal = await this.queryProposal(ctx, proposalId);
if (!proposal) throw new ChaincodeError('Failed to find proposal: ' + proposalId);

proposal.status = 'closed';
proposal.outcome = outcome;
await this.proposalsTable(ctx).put(proposalId, proposal);
}

// Vote on a specific proposal
async voteProposal(ctx, proposalId: string, voter: string, vote: string) {
const proposal = await this.queryProposal(ctx, proposalId);
if (!proposal) throw new ChaincodeError('Failed to find proposal: ' + proposalId);

switch (vote) {
case 'yes':
proposal.yesVotes++;
break;
case 'no':
proposal.noVotes++;
break;
case 'abstain':
proposal.abstainVotes++;
break;
default:
throw new ChaincodeError('Invalid vote');
}

proposal.voteCount++;
await this.proposalsTable(ctx).put(proposalId, proposal);
}

// Private method to get the proposals table from a context
private proposalsTable(ctx: Context) {
return ctx.getStub().getTable('proposals');
}
}

export default VotingContract;
