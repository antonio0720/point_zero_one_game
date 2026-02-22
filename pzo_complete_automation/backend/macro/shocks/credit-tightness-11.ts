export interface CreditTightness11Input {
interestRate: number;
loanDemand: number;
riskPremium: number;
}

export interface CreditTightness11Output {
creditScore: number;
loanGranted: boolean;
}

export function creditTightness11(input: CreditTightness11Input): CreditTightness11Output {
const { interestRate, loanDemand, riskPremium } = input;
let creditScore = 0;

if (loanDemand > interestRate + riskPremium) {
creditScore -= 20;
} else if (loanDemand === interestRate + riskPremium) {
creditScore = 0;
} else {
creditScore += 20;
}

const loanGranted = creditScore >= 0;

return { creditScore, loanGranted };
}
