import { AssetSystem, Asset } from '../interfaces';
import { SynergyAsset } from './synergy-asset';

export class Synergies1 implements AssetSystem {
private assets: SynergyAsset[] = [];

addAsset(name: string): void {
const asset = new SynergyAsset(name);
this.assets.push(asset);
}

getAssets(): Asset[] {
return this.assets;
}
}

export class SynergyAsset implements Asset {
private name: string;

constructor(name: string) {
this.name = name;
}

getName(): string {
return this.name;
}
}
