import { calculateHedgePairs } from '../hedge-pairs';
import { AssetSystem } from '../../asset-system';

describe('Asset systems - hedge-pairs', () => {
const assetSystem1 = new AssetSystem({ id: 'ASSET_SYSTEM_1', name: 'Asset System 1' });
const assetSystem2 = new AssetSystem({ id: 'ASSET_SYSTEM_2', name: 'Asset System 2' });

it('should return correct hedge pairs for two assets with equal weights', () => {
// Given
const assetsInSystem1 = [
{ id: 'ASSET_ID_1', weight: 0.5 },
{ id: 'ASSET_ID_2', weight: 0.5 },
];
assetSystem1.addAssets(assetsInSystem1);

const assetsInSystem2 = [
{ id: 'ASSET_ID_1', weight: 0.5 },
{ id: 'ASSET_ID_3', weight: 0.5 },
];
assetSystem2.addAssets(assetsInSystem2);

// When
const hedgePairs = calculateHedgePairs([assetSystem1, assetSystem2]);

// Then
expect(hedgePairs).toEqual([
{ id: 'ASSET_SYSTEM_1', counterpartId: 'ASSET_SYSTEM_2', hedgePairWeight: 1 },
{ id: 'ASSET_SYSTEM_2', counterpartId: 'ASSET_SYSTEM_1', hedgePairWeight: 1 },
]);
});

it('should return correct hedge pairs for two assets with different weights', () => {
// Given
const assetsInSystem1 = [
{ id: 'ASSET_ID_1', weight: 0.6 },
{ id: 'ASSET_ID_2', weight: 0.4 },
];
assetSystem1.addAssets(assetsInSystem1);

const assetsInSystem2 = [
{ id: 'ASSET_ID_1', weight: 0.3 },
{ id: 'ASSET_ID_3', weight: 0.7 },
];
assetSystem2.addAssets(assetsInSystem2);

// When
const hedgePairs = calculateHedgePairs([assetSystem1, assetSystem2]);

// Then
expect(hedgePairs).toEqual([
{ id: 'ASSET_SYSTEM_1', counterpartId: 'ASSET_SYSTEM_2', hedgePairWeight: 0.9 },
{ id: 'ASSET_SYSTEM_2', counterpartId: 'ASSET_SYSTEM_1', hedgePairWeight: 1.1 },
]);
});
});
