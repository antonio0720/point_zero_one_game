import { Contract } from "../contract";

export class CoopContract extends Contract {
private termLengthInYears: number;
private annualPercentageRate: number;
private loanAmount: number;

constructor(
id: string,
borrowerName: string,
coopName: string,
termLengthInYears: number,
annualPercentageRate: number,
loanAmount: number
) {
super(id, borrowerName);
this.termLengthInYears = termLengthInYears;
this.annualPercentageRate = annualPercentageRate / 100;
this.loanAmount = loanAmount;
}

getCoopName(): string {
return this.coopName;
}

getTermLengthInYears(): number {
return this.termLengthInYears;
}

getAnnualPercentageRate(): number {
return this.annualPercentageRate * 100;
}

getLoanAmount(): number {
return this.loanAmount;
}

calculateMonthlyPayment(): number {
const monthlyInterestRate = (this.annualPercentageRate / 12) / (1 - Math.pow(1 + (this.annualPercentageRate / 12), -(this.termLengthInYears * 12)));
return this.loanAmount * monthlyInterestRate;
}
}
