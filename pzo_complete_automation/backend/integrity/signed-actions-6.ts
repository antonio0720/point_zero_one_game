import * as jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { JWT_SECRET } from '../config';

type SignedAction = {
actionId: string;
timestamp: number;
signature: string;
};

function generateSignature(data: SignedAction, secret: string) {
return crypto.createHmac('sha256', secret).update(JSON.stringify(data)).digest('base64');
}

async function verifySignedAction(data: SignedAction, secret: string): Promise<boolean> {
try {
const receivedSignature = data.signature;
const generatedSignature = generateSignature(data, secret);

return jwt.verify(generatedSignature, JWT_SECRET) as jwt.JwtPayload & SignedAction === data;
} catch (error) {
console.error('Error verifying signed action:', error);
return false;
}
}

function isSignedActionValid(signedAction: SignedAction, currentTime: number): boolean {
const actionTimestamp = signedAction.timestamp;
const validityDuration = 60 * 15; // 15 minutes

return (currentTime - actionTimestamp) <= validityDuration && verifySignedAction(signedAction, JWT_SECRET);
}
