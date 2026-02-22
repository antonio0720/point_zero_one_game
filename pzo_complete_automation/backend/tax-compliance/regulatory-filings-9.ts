type TaxBracket = {
lowerLimit: number;
upperLimit: number;
taxRate: number;
};

const taxBrackets: TaxBracket[] = [
{ lowerLimit: 0, upperLimit: 9876, taxRate: 0.1 },
{ lowerLimit: 9877, upperLimit: 39_815, taxRate: 0.12 },
{ lowerLimit: 39_816, upperLimit: 84_200, taxRate: 0.22 },
// Add more tax brackets as needed...
];

function calculateTaxLiability(income: number, deductions: number): number {
let totalTax = 0;

for (const bracket of taxBrackets) {
const startIncome = bracket.lowerLimit;
const endIncome = Math.min(bracket.upperLimit, income);
const applicableIncome = endIncome - startIncome;

if (applicableIncome > 0) {
totalTax += applicableIncome * bracket.taxRate;
income -= applicableIncome + deductions;
}

if (income <= bracket.lowerLimit) break;
}

return Math.max(totalTax - deductions, 0);
}
