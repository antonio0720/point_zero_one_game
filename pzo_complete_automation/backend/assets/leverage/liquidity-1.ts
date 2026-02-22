import { AssetSystem, Asset } from '@coral-xyz/common';

export class Liquidity1Asset extends Asset {
public constructor(ticker: string, decimals: number) {
super(ticker, decimals);
}
}

export class Liquidity1System extends AssetSystem {
public constructor() {
super('Liquidity-1', 'LIQ1');
}

protected createAsset(): Asset {
return new Liquidity1Asset(this.ticker, this.decimals);
}
}
