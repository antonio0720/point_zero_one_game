import { Contract } from 'fabric-contract-api';
import * as uuid from 'uuid';

class VotingContract extends Contract {
constructor() {
super('org.coop.voting');
}

async initLedger(args: {}) {
console.info('Initializing ledger...');
}

// Create or update the member record with their vote
async submitVote(ctx: Context, memberId: string, candidateId: string) {
const memberExists = await this.memberExists(ctx, memberId);

if (!memberExists) {
throw new Error('Member does not exist');
}

const existingMember = await this.getMemberFromWorldState(ctx, memberId);
let votes = existingMember.votes || [];

// Check if the vote has already been cast
if (votes.includes(candidateId)) {
throw new Error('Vote already cast');
}

votes.push(candidateId);

await ctx.stub.putState(memberId, Buffer.from(JSON.stringify({ ...existingMember, votes })));
}

// Get the number of votes for a specific candidate
async getCandidateVotesCount(ctx: Context, candidateId: string) {
const iter = await ctx.stub.getStateByRange('C', 'Z');
let totalVotes = 0;

while (true) {
const res = await iter.next();
if (res.value && res.value.value.toString()) {
let record = JSON.parse(res.value.value.toString('utf8'));
if (record.votes && record.votes.includes(candidateId)) {
totalVotes++;
}
}
if (res.done) {
break;
}
}
return totalVotes;
}

// Check if a member exists in the ledger
async memberExists(ctx: Context, memberId: string): Promise<boolean> {
const member = await this.getMemberFromWorldState(ctx, memberId);
return (member !== null);
}

private getMemberFromWorldState(ctx: Context, memberId: string): any {
let memberJSON = ctx.stub.getState(memberId).toString('utf8');
let member = JSON.parse(memberJSON ? memberJSON : '{}');
return member;
}
}

export default VotingContract;
