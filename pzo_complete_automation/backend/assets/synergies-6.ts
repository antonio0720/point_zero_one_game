import { Asset } from './Asset';

export class Synergies6 extends Asset {
private _assets: Map<string, Asset> = new Map();

constructor(name: string) {
super(name);
}

loadAssets(assetNames: string[], paths: string[]): void {
for (let i = 0; i < assetNames.length; i++) {
const assetName = assetNames[i];
const assetPath = paths[i];
this._assets.set(assetName, new Asset(assetName, assetPath));
}
}

getAsset(name: string): Asset | undefined {
return this._assets.get(name);
}
}
