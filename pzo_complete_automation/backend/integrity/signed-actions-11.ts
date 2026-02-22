import jwt from 'jsonwebtoken';
import { verify } from 'jsonwebtokentypescript';
import sha256 from 'crypto-js/sha256';
import base64 from 'crypto-js/base64';

interface SignedAction {
action: string;
header: {
alg: string;
kid: string;
typ: string;
};
payload: object;
signature: string;
}

function hash(data: string): string {
return base64.encode(sha256(data)).toString();
}

async function verifySignedAction(signedAction: SignedAction, secretKey: string): Promise<void> {
const decodedHeader = jwt.verify(signedAction.header.raw, secretKey) as jwt.JwtHeader;
const expectedAlgorithm = decodedHeader['alg'];

if (expectedAlgorithm !== 'HS256') {
throw new Error('Unsupported algorithm');
}

const calculatedSignature = hash(JSON.stringify({ header: signedAction.header, payload: signedAction.payload }));
const providedSignature = signedAction.signature;

if (calculatedSignature !== providedSignature) {
throw new Error('Invalid signature');
}
}

async function handleSignedAction(signedAction: SignedAction, secretKey: string): Promise<void> {
try {
await verifySignedAction(signedAction, secretKey);
// Perform action with the verified payload here
} catch (error) {
console.error(`Error processing signed action: ${error.message}`);
throw error;
}
}
