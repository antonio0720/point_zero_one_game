export function calculateSynergy10(assets: number[]): number {
const sum = assets.reduce((a, b) => a + b, 0);
let maxSum = 0;
let subsetCount = 0;

// Generates all possible subsets of the given asset array
function generateSubsets(arr: number[], startIndex: number, currentSet: number[]): void {
for (let i = startIndex; i < arr.length; i++) {
const newSet = [...currentSet, arr[i]];
if (newSet.length > 1 && newSet.every((value, index) => value === assets[index])) {
subsetCount++;
maxSum += Math.max(...newSet);
}
generateSubsets(arr, i + 1, newSet);
}
}

// Generate subsets and calculate maximum sum of unique sets containing at least two elements
generateSubsets(assets, 1, []);

return (sum - maxSum) * subsetCount / 2;
}
