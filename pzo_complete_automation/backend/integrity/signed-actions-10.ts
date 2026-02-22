import * as jwt from 'jsonwebtoken';
import { PublicKey } from 'crypto';

export type SignedAction = {
nonce: string;
action: object;
signature: string;
};

export function verifySignedAction(
signedAction: SignedAction,
publicKey: PublicKey,
): void {
try {
const decoded = jwt.verify(signedAction.signature, publicKey);
const { nonce, action } = JSON.parse(decoded as string);

if (nonce !== signedAction.nonce) {
throw new Error('Invalid nonce');
}

if (JSON.stringify(action) !== JSON.stringify(signedAction.action)) {
throw new Error('Invalid action');
}
} catch (error) {
throw new Error('Invalid signature');
}
}
