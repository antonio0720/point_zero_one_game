import { Asset } from './asset';

export class LiquidAssets {
private assets: Map<string, Asset>;

constructor() {
this.assets = new Map();
}

addAsset(name: string, asset: Asset) {
if (!this.assets.has(name)) {
this.assets.set(name, asset);
} else {
throw new Error(`Duplicate asset name: ${name}`);
}
}

getAsset(name: string): Asset | undefined {
return this.assets.get(name);
}

calculateTotalLiquidity(): number {
let totalLiquidity = 0;
for (const asset of this.assets.values()) {
totalLiquidity += asset.calculateLiquidity();
}
return totalLiquidity;
}
}
