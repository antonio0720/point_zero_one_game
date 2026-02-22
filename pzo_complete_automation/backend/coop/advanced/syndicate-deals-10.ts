import express from 'express';
import { prisma } from '../database/prismaClient';

const router = express.Router();

interface CreateDealInput {
title: string;
description: string;
investmentAmount: number;
}

interface AddMemberInput {
userId: number;
dealId: number;
role: 'investor' | 'partner';
}

router.post('/deals', async (req, res) => {
const { title, description, investmentAmount } = req.body as CreateDealInput;

try {
const newDeal = await prisma.deal.create({
data: {
title,
description,
investmentAmount,
},
});

res.status(201).json(newDeal);
} catch (error) {
console.error(error);
res.status(500).send('Error creating deal');
}
});

router.post('/members', async (req, res) => {
const { userId, dealId, role } = req.body as AddMemberInput;

try {
await prisma.userDeal.create({
data: {
userId,
dealId,
role,
},
});

res.status(201).send('Member added to the deal');
} catch (error) {
console.error(error);
res.status(500).send('Error adding member to the deal');
}
});

router.get('/deals/:id', async (req, res) => {
const { id } = req.params;

try {
const deal = await prisma.deal.findUnique({
where: {
id: Number(id),
},
include: {
users: true,
},
});

res.json(deal);
} catch (error) {
console.error(error);
res.status(500).send('Error fetching deal');
}
});

export default router;
