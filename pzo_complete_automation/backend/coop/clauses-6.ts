interface Cooperative {
id: number;
name: string;
members: Member[];
shares: Share[];
}

interface Member {
id: number;
firstName: string;
lastName: string;
joinDate: Date;
shareId: number;
}

interface Share {
id: number;
price: number;
quantity: number;
}

type WithdrawalRequest = {
memberId: number;
amount: number;
}

function calculateWithdrawableAmount(member: Member, shares: Share[]): number {
const memberShares = shares.filter((share) => share.id === member.shareId);
let totalValue = 0;

memberShares.forEach((share) => {
if (share.quantity > 0) {
totalValue += share.price * share.quantity;
}
});

const joinedYears = calculateJoinedYears(member.joinDate);
const dividendPercentage = getDividendPercentage(joinedYears);
return totalValue * dividendPercentage;
}

function calculateJoinedYears(joinDate: Date): number {
const currentYear = new Date().getFullYear();
return currentYear - joinDate.getFullYear();
}

function getDividendPercentage(years: number): number {
if (years < 1) {
return 0;
} else if (years <= 5) {
return 0.02 * years;
} else if (years <= 10) {
return 0.04 * years - 0.2;
} else {
return 0.06 * years - 2.8;
}
}
