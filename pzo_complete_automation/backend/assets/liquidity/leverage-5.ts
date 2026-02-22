import { Asset } from "./asset";

interface LeveragedAssetProps {
baseAsset: Asset;
leverage: number;
}

export interface Leverage5AssetProps extends LeveragedAssetProps {
leverageLevel: 5;
}

export class Leverage5Asset extends Asset implements Leverage5AssetProps {
constructor(props: Leverage5AssetProps) {
super(props.baseAsset.name);
this.baseAsset = props.baseAsset;
this.leverage = props.leverage;
this.leverageLevel = 5;
}

private _calculateCurrentPrice(): number {
return this.baseAsset.price * this.leverage;
}

public get price(): number {
return this._calculateCurrentPrice();
}

public update(newData: Partial<Leverage5AssetProps>) {
if ("price" in newData) {
this.baseAsset.update(newData);
this._calculateCurrentPrice();
}
Object.assign(this, newData);
}
}
