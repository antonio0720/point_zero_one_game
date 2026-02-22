import * as jwt from 'jsonwebtoken';
import { promisify } from 'util';
import crypto from 'crypto';

const SHA256 = promisify(crypto.createHash('sha256'));

interface SignedAction {
header: { alg: string; typ: string };
payload: object;
signature: string;
}

function verifySignedAction(secret: string, action: SignedAction): boolean {
const decoded = jwt.verify(action.signature, secret);

if (decoded && decoded.header && decoded.payload) {
const expectedHeader = {
alg: 'RS256',
typ: 'signed-action'
};
const actualHeader = JSON.parse( Buffer.from(decoded.header, 'base64url').toString() );

if (JSON.stringify(expectedHeader) === JSON.stringify(actualHeader)) {
const expectedPayload = action.payload;
const actualPayload = decoded.payload;

// Compare the payloads based on your specific payload verification logic
return JSON.stringify(expectedPayload) === JSON.stringify(actualPayload);
}
}

return false;
}

async function generateSignedAction(secret: string, payload: object): Promise<SignedAction> {
const header = JSON.stringify({ alg: 'RS256', typ: 'signed-action' });
const payloadString = JSON.stringify(payload);

const hashedPayload = await SHA256(payloadString);
const signature = jwt.sign(
{ header, payload: hashedPayload },
secret,
{ algorithm: 'RS256' }
);

return {
header: JSON.parse(header),
payload: payload,
signature
};
}
