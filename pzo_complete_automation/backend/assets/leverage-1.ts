import { Promise as BluebirdPromise } from "bluebird";

interface Asset {
id: string;
priority?: number;
dependencies?: string[];
}

class AssetLoader {
private assets: Record<string, Asset> = {};
private loadingAssets: Set<string> = new Set();
private loadedAssets: Set<string> = new Set();

loadAsset(asset: Asset): BluebirdPromise<void> {
const assetId = asset.id;
if (this.loadedAssets.has(assetId)) {
return BluebirdPromise.resolve();
}

this.loadingAssets.add(assetId);

// Simulate loading time or any other operation for the asset
const loadAsset = new BluebirdPromise<void>((resolve) => {
setTimeout(() => {
console.log(`Loading asset ${assetId}`);
this.assets[assetId] = asset;
this.loadedAssets.add(assetId);
this.onAllAssetsLoaded();
resolve();
}, Math.random() * 1000);
});

// Handle dependencies for the asset
if (asset.dependencies) {
const dependencyPromises = asset.dependencies.map((dependencyId) =>
this.loadAsset(this.assets[dependencyId])
);

return BluebirdPromise.all(dependencyPromises).then(() => loadAsset);
}

return loadAsset;
}

onAllAssetsLoaded(): void {
if (this.loadingAssets.size === this.assets.size) {
console.log("All assets loaded");
}
}
}

const assetLoader = new AssetLoader();

// Load assets with dependencies
assetLoader.loadAsset({ id: 'a1', priority: 1, dependencies: ['b1'] })
.then(() => assetLoader.loadAsset({ id: 'b1' }));

assetLoader.loadAsset({ id: 'a2', priority: 2 });
