import express from 'express';
import { prisma } from '../database/prisma-client';

const router = express.Router();

interface Referral {
id?: number;
referrerId: number;
refereeId: number;
createdAt: Date;
}

router.post('/', async (req, res) => {
try {
const { referrerId, refereeId } = req.body;

if (!referrerId || !refereeId) {
return res.status(400).json({ error: 'Both referrerId and refereeId are required.' });
}

const existingReferral = await prisma.referral.findFirst({ where: { OR: [{ referrerId, refereeId }, { refereeId, referrerId }] } });

if (existingReferral) {
return res.status(409).json({ error: 'A referral already exists between these two users.' });
}

const newReferral = await prisma.referral.create({ data: { referrerId, refereeId } });
res.status(201).json(newReferral);
} catch (error) {
console.error(error);
res.status(500).json({ error: 'An error occurred while processing the request.' });
}
});

export default router;
