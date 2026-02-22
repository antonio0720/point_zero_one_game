```typescript
import { AssetSystem } from "./asset-system";

export class Leverage8AssetSystem extends AssetSystem {
constructor(private readonly baseAsset: string, private readonly leverage: number) {
super();
}

calculateAssetPrice(): number {
const baseAssetPrice = this.getBaseAssetPrice();
return baseAssetPrice * this.leverage;
}

calculateAssetValue(quantity: number): number {
const assetPrice = this.calculateAssetPrice();
return assetPrice * quantity;
}
}
```

The `Leverage8AssetSystem` class extends the base `AssetSystem` and takes two parameters in its constructor, `baseAsset` (a string representing the base asset) and `leverage` (a number representing the level of leverage). The `calculateAssetPrice()` method calculates the price of an asset considering the leverage factor, while the `calculateAssetValue(quantity: number)` method calculates the total value of assets given a quantity.
