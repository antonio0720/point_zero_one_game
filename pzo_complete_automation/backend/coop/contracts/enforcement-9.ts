import { CoopContract } from './coop-contract';

export class EnforcementService {
enforce(contract: CoopContract): void {
if (!contract.isValid()) {
throw new Error('Invalid co-op contract');
}

const { contributors, shares, dividends } = contract;

if (contributors.length !== shares.length) {
throw new Error('Number of contributors and shares do not match');
}

contributors.forEach((contributor, index) => {
if (contributor < 0 || contributor > 100) {
throw new Error(`Invalid contribution percentage: ${contributor}`);
}

if (shares[index] < 1 || shares[index] > 1000) {
throw new Error(`Invalid number of shares: ${shares[index]}`);
}
});

let totalDividends = 0;
dividends.forEach((dividend) => {
if (dividend < 0) {
throw new Error('Negative dividend value');
}
totalDividends += dividend;
});

if (totalDividends !== 100) {
throw new Error('Total dividends do not add up to 100%');
}
}
}
