Here's a TypeScript implementation for verifying and maintaining integrity of signed actions based on JSON Web Signature (JWS) using ES262 `jws` library.

```typescript
import jose from 'jose';
import { JWTHeader } from './jwt-header.model';

const JWS_ALGORITHM = 'HS512';
const HEADER_KEY = 'kid';

async function createSignedAction(payload: object, privateKey: string): Promise<string> {
const header: JWTHeader = { alg: JWS_ALGORITHM, typ: 'JWT', kid: jose.JWK.asKeyId(privateKey) };
return await jose.sign(header, privateKey, payload);
}

async function verifySignedAction(signedAction: string, publicKey: string): Promise<object | null> {
const header = jose.jwtVerify(signedAction, publicKey).payload;
if (header[HEADER_KEY] !== jose.JWK.asKeyId(publicKey)) return null;
return header;
}
```

The `createSignedAction` function takes a payload as an object and private key as a string, signs it using the provided algorithm (HS512), and returns the resulting signed action (JWT).

The `verifySignedAction` function checks if a given signed action is valid by verifying its header and using the provided public key. If the verification fails or the header's kid doesn't match the provided public key, it returns null. Otherwise, it returns the verified payload as an object.
