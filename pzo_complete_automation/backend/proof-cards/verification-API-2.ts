import * as jwt from 'jsonwebtoken';
import { ec as EC } from 'elliptic';
import BigNumber from 'bignumber.js';

const ec = new EC('p256');
const G = ec.genKeyPair().getG();
const n = G.order();

function encodeBase64(data: Uint8Array) {
return Buffer.from(data).toString('base64');
}

function decodeBase64(base64: string) {
return Buffer.from(base64, 'base64').toString('utf-8');
}

function getPublicKeyFromJwt(token: string) {
const decoded = jwt.verify(token, process.env.SECRET_KEY);
return decoded.publicKey;
}

function generateProofCardData(message: BigNumber, signature: EC.Signature) {
const r = encodeBase64(signature.r.toArray());
const s = encodeBase64(signature.s.toArray());
return {
message: message.toString(),
r,
s,
publicKey: getPublicKeyFromJwt(token),
};
}

function verifyProofCard(data: any) {
const signature = ec.recoverPubKeyHash(
data.message,
new EC.Signature({
r: fromBase64(data.r),
s: fromBase64(data.s),
})
);

if (signature.getPublicKey().encode('hex') !== data.publicKey) {
throw new Error('Invalid signature');
}

const message = new BigNumber(data.message);
return message.mod(n).eq(0);
}

function fromBase64(base64: string) {
return Buffer.from(base64, 'base64').toString('hex');
}

export { generateProofCardData, verifyProofCard };
