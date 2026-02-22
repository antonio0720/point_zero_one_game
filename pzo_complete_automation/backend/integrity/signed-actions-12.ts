import * as jws from 'jws';
import { ed25519 } from 'ethereum-cryptography/secp256k1';

type SignedActionData = {
id: string;
nonce: string;
deadline: number;
version: number;
chainId: number;
domain: {
name: string;
version: number;
chainId: number;
verifyingContract: string;
};
action: {
name: string;
type?: string;
data: any;
};
};

type SignedAction = string & {
/**
* Verify the signature of a signed action.
*/
verify(): Promise<void>;

/**
* Check if the nonce has been used before.
*/
isNonceFresh(nonces: Map<string, string>): boolean;
};

class SignedActionImpl implements SignedAction {
private signature: string;
private data: SignedActionData;

constructor(signature: string, data: SignedActionData) {
this.signature = signature;
this.data = data;
}

async verify(): Promise<void> {
const publicKey = await ed25519.recoverPublicKey(this.signature);
const recoveredData = await jws.verify(this.signature, 'ES256K', publicKey);

this.data = JSON.parse(Buffer.from(recoveredData.payload!, 'base64').toString());
}

isNonceFresh(nonces: Map<string, string>): boolean {
return !nonces.has(this.data.nonce);
}
}

const signAction = (data: SignedActionData, secretKey: Uint8Array): string => {
const encodedData = Buffer.from(JSON.stringify(data)).toString('base64');
return jws.sign(encodedData, 'ES256K', secretKey);
};

export { SignedActionImpl, signAction };
