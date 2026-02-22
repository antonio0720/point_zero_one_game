import { AssetSystem } from './AssetSystem';
import { Asset } from '../assets/Asset';
import { Synergy4Component } from './Synergy4Component';

export class LiquiditySynergies4 extends AssetSystem {
private synergy4Components: Synergy4Component[];

constructor() {
super();
this.synergy4Components = [];
}

addAsset(asset: Asset) {
if (asset.type === 'Synergy4') {
this.synergy4Components.push(asset as Synergy4Component);
}
super.addAsset(asset);
}

calculateEffect() {
let totalValue = 0;

for (const synergy4Component of this.synergy4Components) {
totalValue += synergy4Component.calculateSynergyEffect();
}

this.totalValue = totalValue;
}
}
