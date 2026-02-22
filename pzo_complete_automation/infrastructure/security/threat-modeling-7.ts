import express from 'express';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

// ThreatActor model
interface ThreatActor {
id: string;
name: string;
description: string;
}

// Vulnerability model
interface Vulnerability {
id: string;
threatActorId: string;
assetId: string;
severity: number;
description: string;
}

// Asset model
interface Asset {
id: string;
name: string;
description: string;
}

app.post('/threatactors', async (req, res) => {
const threatActor: ThreatActor = req.body;
const createdThreatActor = await prisma.threatActor.create({ data: threatActor });
res.json(createdThreatActor);
});

app.post('/vulnerabilities', async (req, res) => {
const vulnerability: Vulnerability = req.body;
const createdVulnerability = await prisma.vulnerability.create({ data: vulnerability });
res.json(createdVulnerability);
});

app.post('/assets', async (req, res) => {
const asset: Asset = req.body;
const createdAsset = await prisma.asset.create({ data: asset });
res.json(createdAsset);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
