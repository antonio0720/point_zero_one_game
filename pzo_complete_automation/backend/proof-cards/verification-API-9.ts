import express from 'express';
import jwt from 'jsonwebtoken';
import { JWK } from 'jwks-rsa';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();
const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());

// Proof card validation middleware
async function verifyProofCard(req, res, next) {
const kid = req.body.header.kid;
const jwksUrl = `${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`;

try {
const keys = await fetch(jwksUrl).then((res) => res.json());
const key = keys.keys.find((k: any) => k.kid === kid);

if (!key) {
return res.status(401).send({ error: 'Invalid Kid' });
}

const jwtVerify = jwt.verify;
jwtVerify.publicKey = new JWK(key, null, true, 'RS256');
req.user = jwtVerify(req.body.id_token);
next();
} catch (error) {
console.error(error);
res.status(401).send({ error: 'Error validating proof card' });
}
}

app.post('/verify', verifyProofCard, (req, res) => {
res.json({ user: req.user });
});

app.listen(port, () => console.log(`Verification API listening on port ${port}`));
