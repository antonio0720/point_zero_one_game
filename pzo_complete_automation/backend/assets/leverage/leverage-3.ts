interface AssetGraph {
baseName: string;
variationsByHash: Map<string, Set<string>>;
assetsByHash: Map<string, Set<Asset>>;
}

interface Asset {
name: string;
path: string;
hash: string;

readFileSync(): Buffer;
}
