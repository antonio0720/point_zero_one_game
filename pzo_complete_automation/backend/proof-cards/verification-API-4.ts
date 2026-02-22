import * as jwt from 'jsonwebtoken';
import { PublicKeyJwk } from 'jwks-rsa';

interface ProofCard {
iss: string;
exp: number;
nonce: string;
proof: {
a: string;
bs: string[];
};
}

const jwksUrl = 'https://your-auth-server.com/.well-known/jwks.json';

function getKey(headers: any, callback: (error: Error | null, key?: PublicKeyJwk | undefined) => void) {
jwt.getPublicKeyFromJwks(jwksUrl, (err, keys) => {
if (err) return callback(err);
const kid = headers['kid'];
const foundKey = keys.keys.find((key: any) => key.kid === kid);
callback(null, foundKey);
});
}

function verifyProofCard(proofCard: ProofCard, publicKey: PublicKeyJwk, callback: (error: Error | null, verified?: boolean) => void) {
const header = { alg: 'RS256', kid: proofCard.headers['kid'] };
jwt.verify(
JSON.stringify({ iss: proofCard.iss }),
publicKey.n,
(err, decoded) => {
if (err) return callback(err);
const { a, bs } = proofCard.proof;
const R = BigInt(`0x${a}`);
const S = bs.map((b: any) => BigInt(`0x${b}`));
const verify = jwt.verify(decoded as string, publicKey.e, { algorithms: ['RS256'] });
if (!verify) return callback(new Error('Proof verification failed'));
const r = BigInt(verify.signature.r);
const s = BigInt(verify.signature.s);
const u = BigInt(proofCard.nonce);
const k = BigInt(proofCard.exp);
if (r * r + s * s !== u * u * k * k) return callback(new Error('Proof verification failed'));
callback(null, true);
}
);
}

export function verifyCard(proofCard: ProofCard, callback: (error: Error | null, verified?: boolean) => void) {
getKey(proofCard.headers, (err, key) => {
if (err) return callback(err);
verifyProofCard(proofCard, key, callback);
});
}
