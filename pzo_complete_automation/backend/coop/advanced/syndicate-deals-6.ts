import { Deal } from './deal';
import { User } from './user';
import { Syndicate } from './syndicate';

async function syndicateDeals(syndicateId: number, dealsToSyndicate: Deal[], usersInSyndicate: User[]): Promise<void> {
const syndicate = new Syndicate(syndicateId);

for (const deal of dealsToSyndicate) {
if (deal.status !== 'available') continue;

const syndicateMembers = usersInSyndicate.filter(user => user.id === syndicate.getLeader().id || user.syndicates.includes(syndicateId));
let dealShareAmount = deal.price / syndicateMembers.length;

for (const member of syndicateMembers) {
member.balance -= dealShareAmount;
member.dealsInSyndicate.push(deal);
await member.save();
}

deal.status = 'syndicated';
deal.syndicates.push(syndicateId);
syndicate.deals.push(deal);
await deal.save();
}

await syndicate.save();
}
