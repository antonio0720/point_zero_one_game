import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

const app = express();
const upload = multer({ dest: 'uploads/' });
const port = process.env.PORT || 3000;

app.use(express.json());

let proofs: string[] = [];

// API endpoint to receive user's proofs
app.post('/receive-proof', upload.array('proofs'), (req, res) => {
req.body.proofIds = req.files.map((file) => file.filename);
next();

function next() {
proofs = [...proofs, ...req.body.proofIds];
fs.writeFileSync(path.join(__dirname, 'proofs.json'), JSON.stringify(proofs));
res.status(201).send('Proof received.');
}
});

// API endpoint to review and adjudicate the proofs
app.post('/adjudicate', (req, res) => {
const { proofIds } = req.body;

if (!Array.isArray(proofIds)) {
return res.status(400).send('Invalid proofIds.');
}

const adjudicatedProofs: string[] = [];

for (const id of proofIds) {
const isAdjudicated = checkProofValidity(id);

if (isAdjuicated) {
adjudicatedProofs.push(id);
}
}

res.status(200).send({ adjudicatedProofs });
});

function checkProofValidity(proofId: string): boolean {
// Implement your proof validation logic here
return proofs.includes(proofId);
}

app.listen(port, () => console.log(`Server listening on port ${port}`));
