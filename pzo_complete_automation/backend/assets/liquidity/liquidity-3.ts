import { AssetSystem, Asset, Balance, TokenAmount } from '@injectivelabs/sdk';
import { ChainId } from '@injectivelabs/chain-info';
import { LiquidityPoolFactoryV3 } from './factories/LiquidityPoolFactoryV3';
import { PoolManager } from './managers/PoolManager';
import { AssetRegistry } from './AssetRegistry';
import { PriceOracle } from './oracles/PriceOracle';

export class LiquidityV3 extends AssetSystem {
private poolManager: PoolManager;
private assetRegistry: AssetRegistry;
private priceOracle: PriceOracle;

constructor() {
super();

this.assetRegistry = new AssetRegistry();
this.poolManager = new PoolManager(new LiquidityPoolFactoryV3());
this.priceOracle = new PriceOracle();
}

async init(): Promise<void> {
await this.assetRegistry.init();
await this.poolManager.init();
await this.priceOracle.init();
}

getChainId(): ChainId {
return ChainId.Injective;
}

async getAssets(chainId?: ChainId): Promise<Asset[]> {
const assets = await this.assetRegistry.getAssets();
return assets;
}

async getBalance(asset: Asset, accountAddress: string): Promise<Balance<TokenAmount>> {
const poolBalances = await this.poolManager.getAccountPoolBalances(accountAddress);
const balance = poolBalances[asset];
return balance;
}
}
