import { AssetSystem } from './asset-system';

function calculateSynergyScore(assetSystem1: AssetSystem, assetSystem2: AssetSystem): number {
const intersectionSize = getIntersectionSize(assetSystem1, assetSystem2);
const unionSize = getUnionSize(assetSystem1, assetSystem2);

if (unionSize === 0) {
return 0;
}

const synergyScore = (intersectionSize / unionSize) * 100;
return Math.round(synergyScore * 100) / 100;
}

function getIntersectionSize(assetSystem1: AssetSystem, assetSystem2: AssetSystem): number {
return assetSystem1.assets.filter((asset) => assetSystem2.assets.includes(asset)).length;
}

function getUnionSize(assetSystem1: AssetSystem, assetSystem2: AssetSystem): number {
return [...assetSystem1.assets, ...assetSystem2.assets].length;
}

class AssetSystem {
assets: string[];

constructor(assets: string[]) {
this.assets = assets;
}
}
