interface TaxableIncome {
income: number;
deductions: number;
}

enum FilingStatus {
Single,
MarriedFilingJointly,
MarriedFilingSeparately,
HeadOfHousehold
}

const TAX_BRACKETS = [
{ bracket: [0, 9750], taxRate: 10 },
{ bracket: [9751, 40000], taxRate: 12 },
{ bracket: [40001, 83500], taxRate: 22 },
{ bracket: [83501, 163500], taxRate: 24 },
{ bracket: [163501, 319700], taxRate: 32 },
{ bracket: [319701, Infinity], taxRate: 35 }
];

function calculateForm1040(income: number, filingStatus: FilingStatus, deductions: number): TaxForm1040 {
const totalTax = calculateTotalTax(income - deductions);
const adjustedGrossIncome = income - deductions;

return {
form1040: {
line1a: adjustedGrossIncome,
line1b: 0, // Standard Deduction for simplicity
line2a: deductions,
line2b: 0, // Medical Expenses, etc. for simplicity
line3: totalTax,
line4: calculateMedicaidGain(adjustedGrossIncome),
line5: calculateEarnedIncomeCredit(income - deductions),
line6: 0, // Additional Child Tax Credit for simplicity
},
taxableIncome: { income, deductions },
};
}

function calculateTotalTax(taxableIncome: number): number {
let total = 0;

TAX_BRACKETS.forEach((bracket) => {
const [lowerLimit, upperLimit] = bracket.bracket;

if (taxableIncome <= upperLimit) {
total += taxableIncome * bracket.taxRate;
taxableIncome -= upperLimit;
} else {
total += upperLimit * bracket.taxRate;
taxableIncome -= upperLimit;

if (taxableIncome > lowerLimit) {
total += taxableIncome * bracket.taxRate;
}
}
});

return total;
}

function calculateMedicaidGain(adjustedGrossIncome: number): number {
// This example calculates Medicaid Gain based on ACA income limits, which are subject to change.
const mgiThreshold = 48_560;
const premiumAmount = 5390;
return Math.min(premiumAmount, (adjustedGrossIncome - mgiThreshold) * 0.02);
}

function calculateEarnedIncomeCredit(income: number): number {
// This example calculates EITC based on a simplified income range and maximum credit amount.
const maxEitc = 3154;
if (income < 18_207) {
return (income * maxEitc) / 18_207;
} else if (income <= 43_692) {
const difference = income - 18_207;
return maxEitc + (difference * maxEitc) / 25_400;
}
return maxEitc;
}
