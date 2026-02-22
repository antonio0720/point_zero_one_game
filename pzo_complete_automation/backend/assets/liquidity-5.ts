import { Contract, Signer } from "ethers";
import { BigNumber } from "@ethersproject/bignumber";
import { LiquidityPoolABI, DAI_ADDRESS, WETH_ADDRESS } from "./abis";

export class LiquidityPool {
private poolContract: Contract;
constructor(signer: Signer, poolAddress: string) {
this.poolContract = new Contract(poolAddress, LiquidityPoolABI, signer);
}

public async getReserveUSD() {
const [reserve0, reserve1] = await Promise.all([
this.poolContract.balanceOf(WETH_ADDRESS),
this.poolContract.balanceOf(DAI_ADDRESS)
]);

return (BigNumber.from(reserve0).add(BigNumber.from(reserve1))).div(
BigNumber.from("2")
);
}

public async depositLiquidity(amountWETH: BigNumber, amountDAI: BigNumber) {
const transactions = [
this.poolContract.swapExactTokensForETH(
amountWETH,
BigNumber.from("0"),
[DAI_ADDRESS],
Date.now() + 60 * 60 * 24 * 7 // 7 days deadline
),
this.poolContract.swapExactTokensForETH(
amountDAI,
BigNumber.from(amountWETH),
[WETH_ADDRESS],
Date.now() + 60 * 60 * 24 * 7 // 7 days deadline
)
];

await Promise.all(transactions);
}
}
