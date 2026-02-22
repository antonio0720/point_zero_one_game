import { SyndicateMember } from "./syndicate-member";

export function syndicateDeals(deal: Deal, members: SyndicateMember[]): SyndicateResult {
const totalInvestment = deal.price * (1 - deal.leverage);
let availableFunds = 0;
const investmentsByMember: Record<string, number> = {};

for (const member of members) {
availableFunds += member.funds;
}

if (availableFunds < totalInvestment) {
throw new Error("Insufficient funds among syndicate members");
}

for (const member of members) {
const desiredPercentage = member.desiredPercentage;
investmentsByMember[member.id] = totalInvestment * (desiredPercentage / 100);
}

let remainingInvestments = totalInvestment;
for (const [id, investment] of Object.entries(investmentsByMember)) {
const memberFunds = members.find((m) => m.id === id)?.funds || 0;
if (memberFunds < investment) {
throw new Error(`Insufficient funds for member ${id}`);
}

remainingInvestments -= investment;
members.find((m) => m.id === id)!.investment = investment;
}

return { totalInvestment, syndicateMembers: members };
}

interface Deal {
price: number;
leverage: number;
}

interface SyndicateMember {
id: string;
funds: number;
desiredPercentage: number;
investment?: number; // This property is optional and will be set by the function
}

interface SyndicateResult {
totalInvestment: number;
syndicateMembers: SyndicateMember[];
}
