export function calculateSynergyScore(assetSystemA: AssetSystem, assetSystemB: AssetSystem): number {
const compatibilityScore = determineCompatibilityScore(assetSystemA, assetSystemB);
const complementarityScore = determineComplementarityScore(assetSystemA, assetSystemB);
return compatibilityScore + complementarityScore;

function determineCompatibilityScore(systemA: AssetSystem, systemB: AssetSystem): number {
const commonAssets = systemA.assets.filter((asset) => systemB.assets.includes(asset));
return commonAssets.length / (systemA.assets.length + systemB.assets.length);
}

function determineComplementarityScore(systemA: AssetSystem, systemB: AssetSystem): number {
const uniqueAssetsA = systemA.assets.filter((asset) => !systemB.assets.includes(asset));
const uniqueAssetsB = systemB.assets.filter((asset) => !systemA.assets.includes(asset));
return (uniqueAssetsA.length * uniqueAssetsB.length) / (systemA.assets.length + systemB.assets.length);
}
}

interface AssetSystem {
assets: string[];
}
