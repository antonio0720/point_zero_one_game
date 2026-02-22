export function calculateSynergy(assets: Asset[]): number {
const totalBaseValue = assets.reduce((sum, asset) => sum + asset.baseValue, 0);
let synergy = 1;

for (let i = 0; i < assets.length - 1; i++) {
for (let j = i + 1; j < assets.length; j++) {
const assetA = assets[i];
const assetB = assets[j];
synergy *= (assetA.baseValue * assetB.synergyFactor) / totalBaseValue;
}
}

return synergy;
}

interface Asset {
baseValue: number;
synergyFactor: number;
}
