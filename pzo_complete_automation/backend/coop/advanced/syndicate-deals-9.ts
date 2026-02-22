type Deal = {
id: number;
name: string;
price: number;
syndicatees: number[];
};

type SyndicatedDeals = {
[dealId: number]: {
deal: Deal;
totalInvestment: number;
syndicateesCount: number;
};
};

function syndicateDeals(deals: Deal[]): SyndicatedDeals {
const syndicatedDeals: SyndicatedDeals = {};

deals.forEach((deal) => {
if (!syndicatedDeals[deal.id]) {
syndicatedDeals[deal.id] = {
deal,
totalInvestment: deal.price,
syndicateesCount: deal.syndicatees.length,
};
}

deal.syndicatees.forEach((syndicateeId) => {
if (syndicatedDeals[syndicateeId]) {
const syndicateeDeal = syndicatedDeals[syndicateeId];
syndicateeDeal.totalInvestment += deal.price;
syndicateeDeal.syndicateesCount++;
}
});
});

return syndicatedDeals;
}
