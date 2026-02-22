import { Asset } from "./Asset";

export class Liquidity4Asset extends Asset {
private _liquidityLevel: number;

constructor(name: string, liquidityLevel: number) {
super(name);
this._liquidityLevel = liquidityLevel;
}

get liquidityLevel(): number {
return this._liquidityLevel;
}

set liquidityLevel(value: number) {
this._liquidityLevel = value;
}

consumeLiquidity(amount: number): void {
if (this._liquidityLevel >= amount) {
this._liquidityLevel -= amount;
} else {
throw new Error("Insufficient liquidity");
}
}

addLiquidity(amount: number): void {
this._liquidityLevel += amount;
}
}
