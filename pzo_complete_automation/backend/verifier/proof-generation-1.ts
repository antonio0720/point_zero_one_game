import * as jwt from 'jsonwebtoken';
import * as sha256 from 'js-sha256';
import { v4 as uuidv4 } from 'uuid';

interface ProofCard {
id: string;
timestamp: number;
nonce: string;
challenge: string;
}

function generateNonce(): string {
return uuidv4();
}

function generateChallenge(nonce: string): string {
const hashedNonce = sha256.hash(nonce).toString();
return hashedNonce.slice(0, 8);
}

async function generateProofCard(): Promise<ProofCard> {
const nonce = generateNonce();
const challenge = generateChallenge(nonce);
const timestamp = Math.floor(Date.now() / 1000);

return { id: uuidv4(), timestamp, nonce, challenge };
}

async function verifyProof(proofCard: ProofCard, token: string): Promise<boolean> {
const secretKey = 'your-secret-key';

try {
jwt.verify(token, secretKey);
const hashedNonce = sha256.hash(proofCard.nonce).toString();
return hashedNonce.slice(0, 8) === proofCard.challenge;
} catch (error) {
console.error('Invalid token or challenge.', error);
return false;
}
}

export { generateProofCard, verifyProof };
