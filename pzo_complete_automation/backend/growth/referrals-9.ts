import express from 'express';
import { prisma } from '../database/prismaClient';

const router = express.Router();

interface Referral {
id: number;
referrerId: number;
refereeId: number;
createdAt: Date;
}

router.post('/create', async (req, res) => {
try {
const referral = await prisma.referral.create({
data: {
referrerId: req.body.referrerId,
refereeId: req.body.refereeId,
},
});
res.status(201).json(referral);
} catch (error) {
console.error(error);
res.status(500).send('An error occurred while creating the referral.');
}
});

router.get('/:id', async (req, res) => {
try {
const referral = await prisma.referral.findUnique({
where: { id: parseInt(req.params.id) },
});
if (!referral) {
return res.status(404).send('Referral not found.');
}
res.json(referral);
} catch (error) {
console.error(error);
res.status(500).send('An error occurred while fetching the referral.');
}
});

export default router;
