import express from 'express';

const router = express.Router();

interface Referral {
id: number;
referrerId: number;
referredUserId: number;
}

let referrals: Referral[] = [];

router.post('/create', (req, res) => {
const { referrerId, referredUserId } = req.body;

if (!referrerId || !referredUserId) {
return res.status(400).json({ message: 'Missing required fields.' });
}

const newReferral: Referral = {
id: Date.now(),
referrerId,
referredUserId,
};

referrals.push(newReferral);

res.status(201).json({ message: 'Referral created.', data: newReferral });
});

router.get('/:id', (req, res) => {
const id = parseInt(req.params.id);

const referral = referrals.find((referral) => referral.id === id);

if (!referral) {
return res.status(404).json({ message: 'Referral not found.' });
}

res.json({ data: referral });
});

export default router;
