import * as jwt from 'jsonwebtoken';
import sha256 from 'crypto-js/sha256';

export type ProofCard = {
id: string;
nonce: string;
timestamp: number;
userId: string;
};

export type VerificationResult = {
isValid: boolean;
message?: string;
};

function createSignature(proofCard: ProofCard, secretKey: string): string {
const data = `${proofCard.nonce}${proofCard.timestamp}${proofCard.userId}`;
return sha256(data + ':' + secretKey).toString();
}

function verifySignature(proofCard: ProofCard, signature: string, secretKey: string): VerificationResult {
const createdSignature = createSignature(proofCard, secretKey);

if (createdSignature !== signature) {
return { isValid: false, message: 'Signature verification failed.' };
}

// You can add additional checks for nonce uniqueness, timestamp validity, etc., here.

return { isValid: true };
}

function verifyProofCard(proofCard: ProofCard, secretKey: string): VerificationResult {
const signature = jwt.sign({}, secretKey); // Create a dummy signature for now. Replace this with a real one in your application.
return verifySignature(proofCard, signature, secretKey);
}
