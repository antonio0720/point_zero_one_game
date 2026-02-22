import { Macro } from "./Macro";

export class CreditTightness6 extends Macro {
constructor() {
super("CreditTightness6");
this.factors = [
new InterestRateFactor(),
new LoanVolumeFactor(),
new DefaultRateFactor()
];
}
}

class InterestRateFactor implements Factor {
public calculate(data: any): number {
// Calculate the impact of interest rates on credit tightness
const currentInterestRate = data.interestRates;
return (currentInterestRate - data.averageInterestRate) * this.weight;
}
}

class LoanVolumeFactor implements Factor {
public calculate(data: any): number {
// Calculate the impact of loan volumes on credit tightness
const currentLoanVolume = data.loanVolumes;
return (currentLoanVolume - data.averageLoanVolume) * this.weight;
}
}

class DefaultRateFactor implements Factor {
public calculate(data: any): number {
// Calculate the impact of default rates on credit tightness
const currentDefaultRate = data.defaultRates;
return (currentDefaultRate - data.averageDefaultRate) * this.weight;
}
}

interface Data {
interestRates: number;
loanVolumes: number;
defaultRates: number;
averageInterestRate: number;
averageLoanVolume: number;
averageDefaultRate: number;
}

interface Factor {
weight: number;
}
