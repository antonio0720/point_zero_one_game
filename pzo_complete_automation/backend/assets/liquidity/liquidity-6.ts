interface Asset {
id: string;
reserve: BigNumber;
}

interface Pool {
feeGrowthGlobal0X128: BigNumber;
feeGrowthGlobal1X128: BigNumber;
sqrtPrice: BigNumber;
liquidity: BigNumber;
tick: number;
assets: Asset[];
}

function calculateLiquidity(pool: Pool, amount0Out: BigNumber, amount1Out: BigNumber): BigNumber {
const x = BigNumber.max([amount0Out.times(pool.sqrtPrice).dividedToIntegerBy(pool.feeGrowthGlobal0X128), amount1Out]);
return x.times(pool.liquidity).dividedToIntegerBy(x.plus(amount0Out).plus(amount1Out));
}
