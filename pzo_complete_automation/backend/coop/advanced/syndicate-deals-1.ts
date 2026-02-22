interface Investor {
id: number;
name: string;
investmentCapital: number;
}

interface Deal {
id: number;
name: string;
value: number;
requiredInvestment: number;
investors: Investor[];
}

class Syndicate {
private deals: Deal[] = [];
private investors: Investor[] = [];

addDeal(deal: Deal): void {
this.deals.push(deal);
}

addInvestor(investor: Investor): void {
this.investors.push(investor);
}

syndicateDeal(dealId: number, investorIndex: number): boolean {
const deal = this.findDealById(dealId);
if (!deal) return false;

const investor = this.findInvestorByIndex(investorIndex);
if (!investor || investor.investmentCapital < deal.requiredInvestment) return false;

deal.investors.push(investor);
investor.investmentCapital -= deal.requiredInvestment;

return true;
}

private findDealById(id: number): Deal | undefined {
return this.deals.find((d) => d.id === id);
}

private findInvestorByIndex(index: number): Investor | undefined {
return this.investors[index];
}
}
