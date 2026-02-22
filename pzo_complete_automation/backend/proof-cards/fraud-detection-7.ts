import * as jwt from 'jsonwebtoken';
import { Groth16, zkProof, ZKProof } from '@zksync-crypto/groth16';
import { Verifier, Proof, Program as SolidityProgram } from 'zexe';
import fs from 'fs';

// Solidity smart contract ABI for fraud detection program
const abi = JSON.parse(fs.readFileSync('FraudDetection.json', 'utf8'));

// Fraud detection program bytecode
const code = fs.readFileSync('FraudDetection.bin', 'hex');

// Private key for generating zero-knowledge proofs
const privateKey = Uint8Array.from(Buffer.from(process.env.PRIVATE_KEY, 'hex'));

// Public key for verifying zero-knowledge proofs
const publicKey = Uint8Array.from(Buffer.from(process.env.PUBLIC_KEY, 'hex'));

// Fraud detection program instance
const fraudDetectionProgram = new SolidityProgram(abi, code);

// Verifier instance for the fraud detection program
const verifier = new Verifier({
program: fraudDetectionProgram,
zkp: Groth16.fullSnark,
});

// Create a verification function that checks the proof and returns either true or false
function verifyProof(proof: ZKProof) {
const zkP = new zkProof({
p: BigInt(proof.p),
vk: publicKey,
pi: BigInt(proof.pi),
wp: BigInt(proof.wp),
a: proof.a,
b: proof.b,
});

const res = verifier.verifyProof(zkP);
return res.isValid;
}

// Example usage
async function main() {
// Generate a new JWT access token with some data (e.g., user ID)
const accessToken = jwt.sign({ userId: 123 }, process.env.SECRET_KEY, { expiresIn: '1h' });

// Assume we have fraud detection program inputs and outputs as JSON objects
const inputs = {
accessToken: accessToken,
userID: 123,
transactionAmount: 1000,
};
const outputs = [
'isFraudulent',
];

// Generate zero-knowledge proof for the fraud detection program with given inputs
const proof = await generateProof(inputs, outputs);

// Verify the generated proof and handle the result
if (verifyProof(proof)) {
console.log('Transaction is not fraudulent');
} else {
console.log('Transaction is suspected of fraud');
}
}

// Generate zero-knowledge proof for the fraud detection program with given inputs and outputs
async function generateProof(inputs: any, outputs: string[]) {
const witness = await verifier.calculateWitness(inputs);

const proof = new zkProof({
p: BigInt(verifier.params.p),
vk: publicKey,
pi: BigInt(verifier.params.commitment.x),
wp: BigInt(verifier.params.commitment.w),
a: witness.a,
b: witness.b,
});

const zkp = new Groth16({ p: proof.p, vk: publicKey });

// Generate the proof with SNARK and return it
await zkp.prove(proof);
return proof;
}

main();
