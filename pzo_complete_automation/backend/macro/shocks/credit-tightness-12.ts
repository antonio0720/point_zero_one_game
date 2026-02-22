export interface CreditTightnessInput {
loanDelinquencyRate: number;
lendingVolume: number;
}

export function creditTightness12(input: CreditTightnessInput): number {
const { loanDelinquencyRate, lendingVolume } = input;

// Adjustable parameters (tune to suit your specific use case)
const delinquencyWeight = 0.7;
const volumeWeight = 0.3;

const delinquencyScore = loanDelinquencyRate * delinquencyWeight;
const volumeScore = lendingVolume * volumeWeight;

return delinquencyScore + volumeScore;
}
