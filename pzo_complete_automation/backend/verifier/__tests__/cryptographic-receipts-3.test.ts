import { Verifier } from "../verifier";
import { ProofCard } from "../../proof-card";
import { CryptographicReceiptV3 } from "../../cryptographic-receipt-v3";
import { expect } from "chai";

describe("Verifier + proof cards - cryptographic-receipts-3", () => {
let verifier: Verifier;

beforeEach(() => {
verifier = new Verifier();
});

it("should verify a valid cryptographic receipt v3", () => {
const proofCard = new ProofCard({});
const cryptographicReceiptV3 = new CryptographicReceiptV3(proofCard);

// Assuming you have a method to generate a valid cryptographic receipt v3
const validCryptographicReceiptV3 = generateValidCryptographicReceiptV3();

expect(verifier.verify(cryptographicReceiptV3)).to.be.true;
});

it("should reject an invalid cryptographic receipt v3", () => {
const proofCard = new ProofCard({});
const cryptographicReceiptV3 = new CryptographicReceiptV3(proofCard);

// Assuming you have a method to generate an invalid cryptographic receipt v3
const invalidCryptographicReceiptV3 = generateInvalidCryptographicReceiptV3();

expect(verifier.verify(cryptographicReceiptV3)).to.be.false;
});
});
