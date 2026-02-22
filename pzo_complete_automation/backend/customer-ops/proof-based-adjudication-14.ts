import { Proof, Claim, Customer } from './interfaces';

function proofBasedAdjudication14(customer: Customer, claims: Claim[], proofs: Proof[]): boolean {
const validatedClaims: Claim[] = [];

for (const claim of claims) {
let isValidProofFound = false;

for (const proof of proofs) {
if (proof.claimId === claim.id && isValidProof(proof)) {
isValidProofFound = true;
break;
}
}

if (isValidProofFound) {
validatedClaims.push(claim);
}
}

const totalAmount = validatedClaims.reduce((total, claim) => total + claim.amount, 0);

return customer.creditLimit >= totalAmount;
}

function isValidProof(proof: Proof): boolean {
// Add your custom proof validation logic here.
// In this example, I assume there's a simple validation that checks if the proof.type matches an allowed type.
return proof.type === 'allowed_proof_type';
}
