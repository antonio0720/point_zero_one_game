import { ProofCard } from './proof-card';

class Verifier {
verifyProof(proof: ProofCard): boolean {
const { header, body } = proof;
const [verificationKey] = header.keys;
const signatures = body.map((card) => card.signature);
const messages = body.map((card) => card.message);

return verifySignatures(signatures, messages, verificationKey);
}
}

function verifySignatures(signatures: string[], messages: string[], verificationKey: string): boolean {
// Implement the signature verification logic here using the provided `verificationKey` and `signatures` arrays.
// The function should return a boolean indicating whether all signatures are valid or not.

// For example, using JSON Web Signature (JWS) and 'jsrsasign' library:

const jws = require('jsrsasign');
const jwt = jws.JWS.createVerify(verificationKey);

let result = true;
messages.forEach((message, index) => {
try {
jwt.update(message);
const signature = signatures[index];
jwt.verifySignature(signature);
} catch (error) {
result = false;
}
});

return result;
}
