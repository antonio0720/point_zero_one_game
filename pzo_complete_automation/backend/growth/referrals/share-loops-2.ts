import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { client } from './redis-client';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

let referralCodes: Record<string, string> = {};

async function setReferralCode(userId: string, code: string) {
referralCodes[code] = userId;
await client.set(code, userId);
}

app.post('/referrals', async (req, res) => {
const userId = req.body.userId;
if (!userId) {
return res.status(400).send({ error: 'User ID is required.' });
}

const code = uuidv4();
await setReferralCode(userId, code);

res.status(201).send({ referralCode: code });
});

app.get('/referrals/:code', async (req, res) => {
const code = req.params.code;
const userId = await client.get(code);

if (!userId) {
return res.status(404).send({ error: 'Referral code not found.' });
}

res.send({ userId });
});

app.listen(port, () => {
console.log(`Server is running on port ${port}`);
});
