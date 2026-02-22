import { MerkleTree } from '@openzeppelin/merkletreejs';
import { keccak256 } from 'ethers/utils/hash';
import { BigNumber } from 'ethers/utils';

class CryptographicReceiptVerifier {
private tree: MerkleTree;
private leafCount: number;

constructor(leafCount: number) {
this.leafCount = leafCount;
const hashFunction = (value: string) => keccak256(value);
this.tree = new MerkleTree(
Array.from({ length: leafCount }, () => '0x0'),
hashFunction,
{ sortPairs: true }
);
}

generateRoot(): Promise<string> {
return new Promise((resolve) => {
this.tree.generateLeafHash(this.tree.getHexProof(0)).then((root) => resolve(root));
});
}

verifyProof(proof: string[], leaf: string): boolean {
const [leafIndex, ...hashChain] = proof;
return this.tree.verify(BigNumber.from(leafIndex), keccak256(leaf), hashChain);
}
}
