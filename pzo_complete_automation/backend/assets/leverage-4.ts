import { createAsset } from 'loader-utils';
import { AssetSystem } from './AssetSystem';

const LeveragedAsset = class extends AssetSystem.Asset {
constructor(public readonly id: string, public readonly callback: () => Promise<void>) {
super(id);
}

async load() {
if (!this._loaded) {
await this.callback();
this._loaded = true;
}
}
};

class LeveragedAssetSystem extends AssetSystem {
constructor() {
super();
this.loaders = new Map([
['leverage-4', (request: string) => createAsset(this.context).callback(() => import(`./assets/${request}`))],
]);
}

getAsset(id: string): AssetSystem.Asset {
const asset = super.getAsset(id);

if (!asset || asset.constructor !== LeveragedAsset) {
return new LeveragedAsset(id, async () => {
this.addAsset(new LeveragedAsset(id, async () => await super.getAsset(id).load()));
});
}

return asset;
}
}

export default LeveragedAssetSystem;
