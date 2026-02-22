import { AssetSystem } from "./AssetSystem";
import { LiquidityPool } from "../pool/LiquidityPool";

export class Leverage11 extends AssetSystem {
private _leverage: number;
private _liquidityPool: LiquidityPool;

constructor(name: string, leverage: number) {
super(name);
this._leverage = leverage;
}

public setLiquidityPool(pool: LiquidityPool): void {
this._liquidityPool = pool;
}

public depositAsset(asset: string, amount: number): void {
const liquidity = this._liquidityPool.getLiquidity(asset);
const adjustedAmount = amount * this._leverage;
this._liquidityPool.deposit(asset, adjustedAmount, this.getName());
}

public withdrawAsset(asset: string, amount: number): void {
const adjustedAmount = amount / this._leverage;
this._liquidityPool.withdraw(asset, adjustedAmount, this.getName());
}
}
