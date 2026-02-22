import express from 'express';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const referrals = [];

app.use(express.json());

app.post('/referral', (req, res) => {
const { code, referrerCode } = req.body;

if (!code || !referrerCode) {
return res.status(400).send('Missing required fields: code and referrerCode');
}

const newReferral = {
id: uuidv4(),
code,
referrerCode,
rewardsEarned: 0,
};

if (referrals.some((referral) => referral.code === referrerCode)) {
// Check if the referrer code already exists in the system
return res.status(409).send('Referrer code already exists.');
}

referrals.push(newReferral);
res.status(201).send(newReferral);
});

app.put('/referral/:id', (req, res) => {
const { id } = req.params;
const index = referrals.findIndex((referral) => referral.id === id);

if (index === -1) {
return res.status(404).send('Referral not found.');
}

// Update the rewards for a specific referral
// ...

res.send(referrals[index]);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
