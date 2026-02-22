import { ec as EC } from 'elliptic';
import MPT from 'merkletreejs';
import keccak256 from 'keccak256';

const ec = new EC('p-256');
const privateKey = Buffer.from(process.env.PRIVATE_KEY, 'hex');
const publicKey = ec.recoverPublicKey(privateKey);

const hashFunction = keccak256;

class CryptographicReceiptVerifier {
trie: MPT;
leafNodes: Map<string, string>;

constructor() {
this.trie = new MPT({ hashLeaf: hashFunction });
this.leafNodes = new Map<string, string>();
}

addLeafNode(dataHash: string, proofCard: string) {
this.leafNodes.set(proofCard, dataHash);
const leafNode = this.trie.getHexProof(hashFunction(dataHash));
this.trie.add(leafNode, proofCard);
}

verifyProofCard(proofCard: string, signature: string) {
const signaturePoint = ec.recoverPubKey(
hashFunction(Array.from(Buffer.from(proofCard))),
Buffer.from(signature, 'hex')
);

if (signaturePoint.verify(hashFunction(proofCard), publicKey)) {
return this.leafNodes.get(proofCard);
}

throw new Error('Invalid proof card or signature');
}
}

export default CryptographicReceiptVerifier;
