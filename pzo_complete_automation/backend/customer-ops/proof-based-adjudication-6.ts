import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { DocumentValidator } from './document-validator';
import { ProofVerifier } from './proof-verifier';
import { Adjudicator } from './adjudicator';

const app = express();
app.use(bodyParser.json());
app.use(cors());

// Initialize validator, verifier and adjudicator
const documentValidator = new DocumentValidator();
const proofVerifier = new ProofVerifier();
const adjudicator = new Adjudicator(proofVerifier);

// Endpoint to receive claims with documents and prove the claim
app.post('/adjudicate', async (req, res) => {
try {
const { document, proof } = req.body;

// Validate document and extract details
const docDetails = await documentValidator.validate(document);

if (!docDetails) {
return res.status(400).json({ error: 'Invalid Document' });
}

// Verify the proof provided for the claim
const verifiedProof = await proofVerifier.verifyProof(proof, docDetails);

if (!verifiedProof) {
return res.status(401).json({ error: 'Unverified Proof' });
}

// Adjudicate based on verified claim and proof
const adjudicatedResult = await adjudicator.adjudicate(docDetails, verifiedProof);

return res.status(200).json(adjudicatedResult);
} catch (error) {
console.error(error);
return res.status(500).json({ error: 'Internal Server Error' });
}
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
